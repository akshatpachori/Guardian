"""
RTSP/Webcam Detection Server with ThreadPool and IoU Tracker
Now supports:
- Pothole detection
- Landslide detection
- Road Accident detection

And saves a summary report to Firebase in the same schema style
as the video upload backend.
"""

import os
import io
import time
import threading
import requests
import uuid
import json
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime

from flask import Flask, Response, render_template_string, jsonify, request
from PIL import Image, ImageDraw, ImageFont
import cv2
import numpy as np

import firebase_admin
from firebase_admin import credentials, firestore

# ============================================================================
# CONFIGURATION
# ============================================================================

ROBOFLOW_API_URL = os.environ.get("ROBOFLOW_API_URL", "https://serverless.roboflow.com")

# --- Pothole Model (legacy/default) ---
ROBOFLOW_POTHOLE_API_KEY = os.environ.get(
    "ROBOFLOW_POTHOLE_API_KEY",
    os.environ.get("ROBOFLOW_API_KEY", "lzo2bYYpJ22lrnKy7Jrf")
)
ROBOFLOW_POTHOLE_MODEL = os.environ.get(
    "ROBOFLOW_POTHOLE_MODEL",
    os.environ.get("ROBOFLOW_MODEL", "pothole-voxrl/1")
)

# --- Landslide Model (NEW) ---
ROBOFLOW_LANDSLIDE_API_KEY = os.environ.get(
    "ROBOFLOW_LANDSLIDE_API_KEY",
    "lzo2bYYpJ22lrnKy7Jrf"
)
ROBOFLOW_LANDSLIDE_MODEL = os.environ.get(
    "ROBOFLOW_LANDSLIDE_MODEL",
    "landslide-detection-yx051/2"
)

# --- Road Accident Model (NEW) ---
ROBOFLOW_ACCIDENT_API_KEY = os.environ.get(
    "ROBOFLOW_ACCIDENT_API_KEY",
    "lzo2bYYpJ22lrnKy7Jrf"
)
ROBOFLOW_ACCIDENT_MODEL = os.environ.get(
    "ROBOFLOW_ACCIDENT_MODEL",
    "accident-detection-cwbvs/2"
)

FRAME_STEP = int(os.environ.get("FRAME_STEP", "5"))
TARGET_WIDTH = int(os.environ.get("TARGET_WIDTH", "640"))
JPEG_QUALITY = int(os.environ.get("JPEG_QUALITY", "80"))
MAX_WORKERS = int(os.environ.get("MAX_WORKERS", "3"))

IOU_THRESHOLD = float(os.environ.get("IOU_THRESHOLD", "0.3"))
MAX_MISSED = int(os.environ.get("MAX_MISSED", "2"))

# Thresholds per hazard type
CONF_THRESHOLD_POTHOLE = float(os.environ.get("CONF_THRESHOLD_POTHOLE",
                                              os.environ.get("CONF_THRESHOLD", "0.80")))
CONF_THRESHOLD_LANDSLIDE = float(os.environ.get("CONF_THRESHOLD_LANDSLIDE", "0.72"))
CONF_THRESHOLD_ACCIDENT = float(os.environ.get("CONF_THRESHOLD_ACCIDENT", "0.85"))

# For legacy use (UI display etc.), treat CONF_THRESHOLD as pothole threshold
CONF_THRESHOLD = CONF_THRESHOLD_POTHOLE

REPORT_DIR = os.path.join(os.path.dirname(__file__), "reports")
os.makedirs(REPORT_DIR, exist_ok=True)

# Firebase configuration (same key path as other backend)
FIREBASE_KEY_PATH = r"D:\Major Project\Guardian App\Server\firebase_key.json"

# ============================================================================
# GLOBAL STATE
# ============================================================================

latest_frame_jpeg = None
pending_futures = 0
state_lock = threading.Lock()

running = False
worker_thread = None
executor = None
current_source = None

track_registry = {}

# store approximate frame size for risk computation
stream_frame_width = TARGET_WIDTH
stream_frame_height = TARGET_WIDTH

app = Flask(__name__)

INDEX_HTML = """
<!doctype html>
<html>
<head>
    <title>RTSP Detection Server</title>
    <style>
        body { font-family: Arial; max-width: 1200px; margin: 0 auto; padding: 20px; }
        h1 { color: #023047; }
        .controls { margin: 20px 0; }
        button { padding: 10px 20px; margin: 5px; font-size: 14px; cursor: pointer; }
        .video { max-width: 100%; border: 2px solid #ddd; }
    </style>
</head>
<body>
    <h1>RTSP Detection Server</h1>
    <div class="controls">
        <p>Config: FRAME_STEP={{ frame_step }}, TARGET_WIDTH={{ target_width }}, MAX_WORKERS={{ max_workers }}, CONF_THRESHOLD(POTHOLE)={{ conf_threshold }}</p>
        <form method="post" action="/start_stream" style="display:inline;">
            <button type="submit">Start Stream</button>
        </form>
        <form method="post" action="/stop_stream" style="display:inline;">
            <button type="submit">Stop Stream & Generate Report</button>
        </form>
    </div>
    <img src="{{ url_for('video_feed') }}" class="video"/>
</body>
</html>
"""

# ============================================================================
# FIREBASE INIT
# ============================================================================

try:
    cred = credentials.Certificate(FIREBASE_KEY_PATH)
    firebase_admin.initialize_app(cred)
    db = firestore.client()
    print("[INFO] Firebase initialized successfully (RTSP backend)")
except Exception as e:
    print(f"[ERROR] Firebase initialization failed: {e}")
    db = None

# ============================================================================
# IoU TRACKER
# ============================================================================

def iou(boxA, boxB):
    xA = max(boxA[0], boxB[0])
    yA = max(boxA[1], boxB[1])
    xB = min(boxA[2], boxB[2])
    yB = min(boxA[3], boxB[3])
    interW = max(0, xB - xA)
    interH = max(0, yB - yA)
    interArea = interW * interH
    if interArea == 0:
        return 0.0
    boxAArea = max(0, boxA[2]-boxA[0]) * max(0, boxA[3]-boxA[1])
    boxBArea = max(0, boxB[2]-boxB[0]) * max(0, boxB[3]-boxB[1])
    return interArea / float(boxAArea + boxBArea - interArea + 1e-9)

class SimpleTracker:
    def __init__(self, iou_threshold=0.3, max_missed=6):
        self.next_id = 1
        self.tracks = {}
        self.iou_threshold = iou_threshold
        self.max_missed = max_missed

    def _pred_to_bbox(self, p):
        if all(k in p for k in ("x","y","width","height")):
            cx, cy, w, h = p["x"], p["y"], p["width"], p["height"]
            x1 = cx - w/2
            y1 = cy - h/2
            x2 = cx + w/2
            y2 = cy + h/2
            return [int(x1), int(y1), int(x2), int(y2)]
        elif "bbox" in p and isinstance(p["bbox"], (list,tuple)) and len(p["bbox"])==4:
            x1, y1, x2, y2 = p["bbox"]
            return [int(x1), int(y1), int(x2), int(y2)]
        return None

    def update(self, preds):
        new_boxes = []
        for p in preds:
            bb = self._pred_to_bbox(p)
            if bb is not None:
                conf = float(p.get("confidence", 0.0))
                new_boxes.append({
                    "bbox": bb,
                    "label": p.get("class","obj"),
                    "conf": conf
                })

        if len(self.tracks) == 0:
            for nb in new_boxes:
                tid = self.next_id
                self.next_id += 1
                self.tracks[tid] = {
                    "bbox": nb["bbox"],
                    "missed": 0,
                    "label": nb["label"],
                    "conf": nb["conf"]
                }
            return self._export_tracks()

        if len(new_boxes) == 0:
            for tid in list(self.tracks.keys()):
                self.tracks[tid]["missed"] += 1
            to_delete = [tid for tid, t in self.tracks.items() if t["missed"] > self.max_missed]
            for tid in to_delete:
                del self.tracks[tid]
            return self._export_tracks()

        track_ids = list(self.tracks.keys())
        iou_matrix = np.zeros((len(track_ids), len(new_boxes)), dtype=float)
        for i, tid in enumerate(track_ids):
            for j, nb in enumerate(new_boxes):
                iou_matrix[i,j] = iou(self.tracks[tid]["bbox"], nb["bbox"])

        matched_tracks = set()
        matched_boxes = set()
        matches = []
        flat = []
        for i in range(iou_matrix.shape[0]):
            for j in range(iou_matrix.shape[1]):
                flat.append((iou_matrix[i,j], i, j))
        flat.sort(reverse=True, key=lambda x: x[0])

        for score, i, j in flat:
            if score < self.iou_threshold:
                break
            if i in matched_tracks or j in matched_boxes:
                continue
            matched_tracks.add(i)
            matched_boxes.add(j)
            matches.append((i, j, score))

        for i, j, score in matches:
            tid = track_ids[i]
            nb = new_boxes[j]
            self.tracks[tid]["bbox"] = nb["bbox"]
            self.tracks[tid]["missed"] = 0
            self.tracks[tid]["label"] = nb["label"]
            self.tracks[tid]["conf"] = nb["conf"]

        for j, nb in enumerate(new_boxes):
            if j not in matched_boxes:
                tid = self.next_id
                self.next_id += 1
                self.tracks[tid] = {
                    "bbox": nb["bbox"],
                    "missed": 0,
                    "label": nb["label"],
                    "conf": nb["conf"]
                }

        for i, tid in enumerate(track_ids):
            if i not in matched_tracks:
                self.tracks[tid]["missed"] += 1

        to_delete = [tid for tid, t in self.tracks.items() if t["missed"] > self.max_missed]
        for tid in to_delete:
            del self.tracks[tid]

        return self._export_tracks()

    def _export_tracks(self):
        out = []
        for tid, t in self.tracks.items():
            out.append({
                "id": tid,
                "bbox": t["bbox"],
                "label": t["label"],
                "conf": t["conf"]
            })
        return out

tracker = SimpleTracker(iou_threshold=IOU_THRESHOLD, max_missed=MAX_MISSED)

# ============================================================================
# ROBOFLOW & IMAGE PROCESSING (MULTI-MODEL)
# ============================================================================

def _call_single_model(image_bytes, model_id, api_key, timeout=60):
    url = f"{ROBOFLOW_API_URL}/{model_id}"
    params = {"api_key": api_key}
    files = {"file": ("frame.jpg", io.BytesIO(image_bytes), "image/jpeg")}
    resp = requests.post(url, params=params, files=files, timeout=timeout)
    resp.raise_for_status()
    return resp.json()

def call_roboflow_image_bytes(image_bytes):
    """
    Call ALL THREE Roboflow models on the same frame and
    return a combined predictions list.

    image_bytes: raw JPEG bytes (not BytesIO)
    """
    combined = []

    # (model_id, api_key, threshold, label_hint, timeout)
    configs = [
        (ROBOFLOW_POTHOLE_MODEL,   ROBOFLOW_POTHOLE_API_KEY,   CONF_THRESHOLD_POTHOLE,   "pothole",   30),
        (ROBOFLOW_LANDSLIDE_MODEL, ROBOFLOW_LANDSLIDE_API_KEY, CONF_THRESHOLD_LANDSLIDE, "landslide", 90),
        (ROBOFLOW_ACCIDENT_MODEL,  ROBOFLOW_ACCIDENT_API_KEY,  CONF_THRESHOLD_ACCIDENT,  "accident",  60),
    ]

    for model_id, api_key, thres, hazard_name, timeout in configs:
        try:
            resp = _call_single_model(image_bytes, model_id, api_key, timeout=timeout)
            preds = resp.get("predictions", []) if isinstance(resp, dict) else []
        except requests.exceptions.Timeout:
            print(f"[WARN] Roboflow TIMEOUT for model {model_id}")
            preds = []
        except Exception as e:
            print(f"[ERROR] Roboflow call failed for model {model_id}: {e}")
            preds = []

        for p in preds:
            try:
                conf = float(p.get("confidence", 0.0))
            except Exception:
                conf = 0.0
            if conf < thres:
                continue

            # Ensure label reflects hazard type, but keep original if present
            lbl = p.get("class", hazard_name)
            if hazard_name.lower() not in lbl.lower():
                # prepend hazard type to be safe
                lbl = f"{hazard_name}_{lbl}"
            p["class"] = lbl
            combined.append(p)

    return {"predictions": combined}

def draw_tracked_boxes(img, tracks):
    draw = ImageDraw.Draw(img)
    try:
        font = ImageFont.truetype("arial.ttf", 14)
    except Exception:
        font = ImageFont.load_default()

    for t in tracks:
        x1, y1, x2, y2 = t["bbox"]
        x1, y1, x2, y2 = int(max(0, x1)), int(max(0, y1)), int(max(0, x2)), int(max(0, y2))

        label = str(t.get("label", "obj"))
        low = label.lower()

        # 🎨 Color per hazard type (RGB)
        if "accident" in low:
            box_color = (255, 0, 0)      # Red
        elif "landslide" in low:
            box_color = (0, 255, 0)      # Green
        elif "pothole" in low:
            box_color = (0, 128, 255)    # Blue-ish
        else:
            box_color = (255, 255, 0)    # Yellow for unknown

        draw.rectangle([x1, y1, x2, y2], outline=box_color, width=3)

        text = f'ID:{t["id"]} {label} {t.get("conf", 0):.2f}'
        # Slight padding above the box
        text_x = x1 + 3
        text_y = max(0, y1 - 16)
        # Text in white for visibility
        draw.text((text_x, text_y), text, fill=(255, 255, 255), font=font)

    return img


def _register_new_tracks(returned_tracks):
    global track_registry
    now_ts = time.time()
    for t in returned_tracks:
        tid = int(t.get("id"))
        if tid not in track_registry:
            track_registry[tid] = {
                "label": t.get("label", "pothole"),
                "first_seen_ts": now_ts,
                "first_seen_iso": datetime.utcfromtimestamp(now_ts).isoformat() + "Z",
                "first_conf": float(t.get("conf", 0.0)),
                "bbox": t.get("bbox")
            }

def inference_callback(future):
    global pending_futures, tracker, track_registry
    try:
        resp = future.result()
        preds = resp.get("predictions", []) if isinstance(resp, dict) else []
    except Exception as e:
        print(f"[ERROR] Inference error: {e}")
        preds = []

    # NO extra thresholding here; thresholds already applied per model
    filtered = preds

    with state_lock:
        returned_tracks = tracker.update(filtered)
        _register_new_tracks(returned_tracks)
        pending_futures = max(0, pending_futures - 1)

# ============================================================================
# RTSP WORKER
# ============================================================================

def rtsp_worker(executor_local, video_source):
    global latest_frame_jpeg, pending_futures, running, tracker
    global stream_frame_width, stream_frame_height

    cap = cv2.VideoCapture(video_source)
    if not cap.isOpened():
        print(f"[ERROR] Cannot open video source: {video_source}")
        with state_lock:
            running = False
        return

    frame_idx = 0
    print(f"[INFO] RTSP worker started with source: {video_source}")

    while True:
        with state_lock:
            should_run = running
        if not should_run:
            break

        ret, frame = cap.read()
        if not ret:
            print("[WARNING] Failed to read frame")
            time.sleep(0.1)
            continue

        h, w = frame.shape[:2]
        if w != TARGET_WIDTH:
            scale = TARGET_WIDTH / w
            frame = cv2.resize(frame, (TARGET_WIDTH, int(h*scale)), interpolation=cv2.INTER_LINEAR)

        # update global frame size for risk estimation
        with state_lock:
            stream_frame_width = frame.shape[1]
            stream_frame_height = frame.shape[0]

        should_detect = (frame_idx % FRAME_STEP == 0)

        if should_detect:
            with state_lock:
                can_submit = pending_futures < MAX_WORKERS and executor_local is not None
            if can_submit:
                success, buf = cv2.imencode('.jpg', frame, [int(cv2.IMWRITE_JPEG_QUALITY), JPEG_QUALITY])
                if success:
                    # pass raw bytes to multi-model function
                    image_bytes = buf.tobytes()
                    try:
                        future = executor_local.submit(call_roboflow_image_bytes, image_bytes)
                        with state_lock:
                            pending_futures += 1
                        future.add_done_callback(inference_callback)
                    except Exception as e:
                        print(f"[ERROR] Failed to submit inference: {e}")

        with state_lock:
            tracks = tracker._export_tracks()

        rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
        pil = Image.fromarray(rgb)
        pil = draw_tracked_boxes(pil, tracks)

        jiobuf = io.BytesIO()
        pil.save(jiobuf, format="JPEG", quality=JPEG_QUALITY)
        jpeg_bytes = jiobuf.getvalue()

        with state_lock:
            latest_frame_jpeg = jpeg_bytes

        frame_idx += 1

    cap.release()
    print("[INFO] RTSP worker stopped")

# ============================================================================
# FLASK ROUTES
# ============================================================================

@app.route("/")
def index():
    return render_template_string(
        INDEX_HTML,
        frame_step=FRAME_STEP,
        target_width=TARGET_WIDTH,
        max_workers=MAX_WORKERS,
        conf_threshold=CONF_THRESHOLD_POTHOLE
    )

def generate_mjpeg():
    global latest_frame_jpeg, running
    while True:
        with state_lock:
            frame = latest_frame_jpeg
            should_run = running
        if not should_run:
            time.sleep(0.1)
            continue
        if frame is None:
            time.sleep(0.02)
            continue
        yield (b'--frame\r\n'
               b'Content-Type: image/jpeg\r\n\r\n' + frame + b'\r\n')
        time.sleep(0.03)

@app.route("/video_feed")
def video_feed():
    return Response(generate_mjpeg(), mimetype='multipart/x-mixed-replace; boundary=frame')

@app.route("/hazards")
def hazards():
    with state_lock:
        tracks = tracker._export_tracks()
        tracks_copy = [dict(t) for t in tracks]
    counts = {}
    for t in tracks_copy:
        lbl = t.get("label", "pothole")
        counts[lbl] = counts.get(lbl, 0) + 1
    total = sum(counts.values())
    return jsonify({
        "timestamp": time.time(),
        "total": total,
        "by_label": counts,
        "tracks": tracks_copy
    })

@app.route("/status")
def status():
    with state_lock:
        is_running = running
        pf = pending_futures
        reg_count = len(track_registry)
        src = current_source
    return jsonify({
        "running": is_running,
        "pending_futures": pf,
        "tracked_unique_count": reg_count,
        "current_source": str(src) if src is not None else None
    })

@app.route("/start_stream", methods=["POST"])
def start_stream():
    global running, worker_thread, executor, track_registry, pending_futures, current_source

    with state_lock:
        if running:
            return jsonify({"status": "already_running", "current_source": str(current_source)}), 200

        data = request.get_json(silent=True) or {}
        rtsp_url = data.get("rtsp_url", "").strip()

        if rtsp_url == "0" or rtsp_url == "":
            video_source = 0
            source_type = "webcam"
        else:
            video_source = rtsp_url
            source_type = "rtsp"

        print(f"[INFO] Starting stream: {source_type} = {video_source}")

        track_registry = {}
        pending_futures = 0
        current_source = video_source
        running = True

        executor = ThreadPoolExecutor(max_workers=MAX_WORKERS)
        worker_thread = threading.Thread(
            target=rtsp_worker,
            args=(executor, video_source),
            daemon=True
        )
        worker_thread.start()

    return jsonify({
        "status": "started",
        "timestamp": time.time(),
        "source_type": source_type,
        "source": str(video_source)
    }), 200

@app.route("/stop_stream", methods=["POST"])
def stop_stream():
    global running, worker_thread, executor, track_registry, pending_futures, current_source
    global stream_frame_width, stream_frame_height

    with state_lock:
        running = False
        stopped_source = current_source
        current_source = None

    if worker_thread is not None:
        worker_thread.join(timeout=10)
        worker_thread = None

    if executor is not None:
        try:
            executor.shutdown(wait=True)
        except Exception as e:
            print(f"[ERROR] Executor shutdown: {e}")
        executor = None

    # copy registry safely
    with state_lock:
        registry_copy = {k: dict(v) for k, v in track_registry.items()}
        frame_w = max(1, int(stream_frame_width))
        frame_h = max(1, int(stream_frame_height))

    # Build the original style report (for HTTP response & JSON file)
    counts = {}
    tracks_list = []
    for tid, info in registry_copy.items():
        lbl = info.get("label", "pothole")
        counts[lbl] = counts.get(lbl, 0) + 1
        tracks_list.append({
            "id": int(tid),
            "label": lbl,
            "first_seen_iso": info.get("first_seen_iso"),
            "first_seen_ts": info.get("first_seen_ts"),
            "first_conf": info.get("first_conf"),
            "bbox": info.get("bbox")
        })

    total_unique_tracked = sum(counts.values())

    report_id = str(uuid.uuid4())
    now_ts = time.time()
    report = {
        "report_id": report_id,
        "generated_at_ts": now_ts,
        "generated_at_iso": datetime.utcfromtimestamp(now_ts).isoformat() + "Z",
        "source": str(stopped_source),
        "total_unique_tracked": total_unique_tracked,
        "by_label": counts,
        "tracks": sorted(tracks_list, key=lambda x: x["first_seen_ts"] if x["first_seen_ts"] is not None else 0)
    }

    fname = f"report_{int(now_ts)}.json"
    fpath = os.path.join(REPORT_DIR, fname)
    try:
        with open(fpath, "w") as fh:
            json.dump(report, fh, indent=2)
        print(f"[INFO] Report saved locally: {fpath}")
    except Exception as e:
        print(f"[ERROR] Save report: {e}")

    # ------------------------------------------------------------------
    # EXTRA: Compute risk + save to Firebase in "upload backend" format
    # ------------------------------------------------------------------

    pothole_unique = 0
    landslide_unique = 0
    accident_unique = 0

    pothole_risk = 0.0
    landslide_risk = 0.0
    accident_risk = 0.0

    frame_area = float(frame_w * frame_h)

    for tid, info in registry_copy.items():
        lbl = str(info.get("label", "pothole")).lower()
        bbox = info.get("bbox") or [0, 0, 0, 0]
        if not (isinstance(bbox, (list, tuple)) and len(bbox) == 4):
            continue
        x1, y1, x2, y2 = bbox
        w = max(0, x2 - x1)
        h = max(0, y2 - y1)
        area = float(w * h)
        if frame_area <= 0:
            normalized = 0.0
        else:
            normalized = area / frame_area

        # classify hazard type by label
        if "accident" in lbl:
            accident_unique += 1
            accident_risk += normalized
        elif "landslide" in lbl:
            landslide_unique += 1
            landslide_risk += normalized
        else:
            # default to pothole
            pothole_unique += 1
            pothole_risk += normalized

    total_risk = pothole_risk + landslide_risk + accident_risk
    risk_score = min(total_risk * 100.0, 100.0)

    # Determine primary hazard (same priority style as upload backend)
    if accident_unique > 0 or accident_risk > 0:
        hazard_detected = "accident"
    elif landslide_unique > 0 or landslide_risk > 0:
        hazard_detected = "landslide"
    elif pothole_unique > 0 or pothole_risk > 0:
        hazard_detected = "pothole"
    else:
        hazard_detected = "none"

    # Build Firestore document in same style as video upload backend
    report_data = {
        "report_id": report_id,
        "timestamp": report["generated_at_iso"],
        "file_type": "stream",
        "original_filename": None,

        "hazard_detected": hazard_detected,
        "risk_score": round(risk_score, 2),

        "total_unique_potholes": pothole_unique,
        "total_risk": total_risk,

        "total_frames": None,
        "processed_frames": None,
        "output_file": None,

        "confidence_threshold": CONF_THRESHOLD_POTHOLE,
        "pothole_unique": pothole_unique,
        "landslide_unique": landslide_unique,
        "accident_unique": accident_unique,
        "pothole_risk": pothole_risk,
        "landslide_risk": landslide_risk,
        "accident_risk": accident_risk,
        "confidence_thresholds": {
            "pothole": CONF_THRESHOLD_POTHOLE,
            "landslide": CONF_THRESHOLD_LANDSLIDE,
            "accident": CONF_THRESHOLD_ACCIDENT,
        },

        # RTSP-specific fields
        "source": report["source"],
        "total_unique_tracked": total_unique_tracked,
        "by_label": counts,
        "tracks": tracks_list,
        "report_file_path": fpath,
    }

    if db is not None:
        try:
            db.collection("reports").document(report_id).set(report_data)
            print(f"[INFO] Report saved to Firebase: {report_id}")
        except Exception as e:
            print(f"[ERROR] Failed to save to Firebase: {e}")

    return jsonify({"status": "stopped", "report": report, "saved_to": fpath}), 200

# ============================================================================
# MAIN
# ============================================================================

def main():
    print("=" * 70)
    print("RTSP Detection Server Starting")
    print("=" * 70)
    print(f"Pothole Model   : {ROBOFLOW_POTHOLE_MODEL} (th={CONF_THRESHOLD_POTHOLE})")
    print(f"Landslide Model : {ROBOFLOW_LANDSLIDE_MODEL} (th={CONF_THRESHOLD_LANDSLIDE})")
    print(f"Accident Model  : {ROBOFLOW_ACCIDENT_MODEL} (th={CONF_THRESHOLD_ACCIDENT})")
    print(f"Confidence Threshold (legacy display): {CONF_THRESHOLD}")
    print(f"Server: http://0.0.0.0:8501")
    print("=" * 70)
    app.run(host="0.0.0.0", port=8501, threaded=True)

if __name__ == "__main__":
    main()
