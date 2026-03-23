"""
Video Upload Backend with Roboflow Detection & Firebase Storage
Processes uploaded videos/images and stores reports in Firestore

Supports:
- Pothole detection
- Landslide detection
- Road Accident detection
"""

from flask import Flask, request, jsonify
from flask_cors import CORS
import cv2
import os
import uuid
import io
import time
import requests
from datetime import datetime
import firebase_admin
from firebase_admin import credentials, firestore
from PIL import Image, ImageDraw, ImageFont

# ============================================================================
# CONFIGURATION
# ============================================================================

# Firebase Configuration
FIREBASE_KEY_PATH = r"D:\Major Project\Guardian App\Server\firebase_key.json"

# Roboflow Base URL
ROBOFLOW_API_URL = os.environ.get("ROBOFLOW_API_URL", "https://serverless.roboflow.com")

# --- Pothole Model (existing) ---
ROBOFLOW_POTHOLE_API_KEY = os.environ.get("ROBOFLOW_POTHOLE_API_KEY", "lzo2bYYpJ22lrnKy7Jrf")
ROBOFLOW_POTHOLE_MODEL = os.environ.get("ROBOFLOW_POTHOLE_MODEL", "pothole-voxrl/1")

# --- Landslide Model (NEW) ---
ROBOFLOW_LANDSLIDE_API_KEY = os.environ.get("ROBOFLOW_LANDSLIDE_API_KEY", "lzo2bYYpJ22lrnKy7Jrf")
ROBOFLOW_LANDSLIDE_MODEL = os.environ.get("ROBOFLOW_LANDSLIDE_MODEL", "landslide-detection-yx051/2")

# --- Road Accident Model (NEW) ---
ROBOFLOW_ACCIDENT_API_KEY = os.environ.get("ROBOFLOW_ACCIDENT_API_KEY", "lzo2bYYpJ22lrnKy7Jrf")
ROBOFLOW_ACCIDENT_MODEL = os.environ.get("ROBOFLOW_ACCIDENT_MODEL", "accident-detection-cwbvs/2")

# Detection Thresholds
CONF_THRESHOLD_POTHOLE = float(os.environ.get("CONF_THRESHOLD_POTHOLE", "0.80"))  # 80%
CONF_THRESHOLD_LANDSLIDE = float(os.environ.get("CONF_THRESHOLD_LANDSLIDE", "0.35"))  # 35%
CONF_THRESHOLD_ACCIDENT = float(os.environ.get("CONF_THRESHOLD_ACCIDENT", "0.70"))    # 70%

# Frame skip for video
FRAME_SKIP = int(os.environ.get("FRAME_SKIP", "5"))  # Process every Nth frame for videos

# Output Configuration
OUTPUT_DIR = "Detect"
os.makedirs(OUTPUT_DIR, exist_ok=True)

# ============================================================================
# INITIALIZE FIREBASE
# ============================================================================

try:
    cred = credentials.Certificate(FIREBASE_KEY_PATH)
    firebase_admin.initialize_app(cred)
    db = firestore.client()
    print("[INFO] Firebase initialized successfully")
except Exception as e:
    print(f"[ERROR] Firebase initialization failed: {e}")
    db = None

# ============================================================================
# INITIALIZE FLASK
# ============================================================================

app = Flask(__name__)
CORS(app)
app.config['MAX_CONTENT_LENGTH'] = 1024 * 1024 * 1024  # 1 GB

# ============================================================================
# ROBOFLOW API
# ============================================================================

def call_roboflow_image(image_bytes, model_id, api_key, timeout=60, retries=2):
    """
    Call Roboflow API with image bytes for a specific model.

    Args:
        image_bytes: BytesIO object or bytes containing JPEG image
        model_id: Roboflow model ID (e.g. "pothole-voxrl/1")
        api_key: Roboflow API key
        timeout: per-request timeout in seconds
        retries: number of times to retry on timeout / network error

    Returns:
        JSON response with predictions, or {"predictions": []} on failure
    """
    url = f"{ROBOFLOW_API_URL}/{model_id}"
    params = {"api_key": api_key}

    def make_files():
        if isinstance(image_bytes, io.BytesIO):
            image_bytes.seek(0)
            return {"file": ("frame.jpg", image_bytes, "image/jpeg")}
        else:
            return {"file": ("frame.jpg", io.BytesIO(image_bytes), "image/jpeg")}

    for attempt in range(1, retries + 1):
        try:
            files = make_files()
            resp = requests.post(url, params=params, files=files, timeout=timeout)
            resp.raise_for_status()
            return resp.json()
        except requests.exceptions.Timeout:
            print(f"[WARN] Roboflow TIMEOUT for model {model_id} (attempt {attempt}/{retries})")
            if attempt == retries:
                break
        except Exception as e:
            print(f"[ERROR] Roboflow API call failed for model {model_id} (attempt {attempt}/{retries}): {e}")
            if attempt == retries:
                break

    return {"predictions": []}

# ============================================================================
# DRAWING UTILITIES
# ============================================================================

def draw_boxes_cv2(frame, predictions, conf_threshold, color=(0, 0, 255), label_prefix=None):
    """
    Draw bounding boxes on OpenCV frame.

    Args:
        frame: OpenCV frame (numpy array)
        predictions: List of Roboflow predictions
        conf_threshold: confidence threshold for this model
        color: BGR tuple for box color
        label_prefix: optional string prefix (e.g. "POT")

    Returns:
        Frame with drawn boxes
    """
    for pred in predictions:
        conf = float(pred.get("confidence", 0))
        if conf < conf_threshold:
            continue

        if all(k in pred for k in ("x", "y", "width", "height")):
            cx, cy, w, h = pred["x"], pred["y"], pred["width"], pred["height"]
            x1 = int(cx - w / 2)
            y1 = int(cy - h / 2)
            x2 = int(cx + w / 2)
            y2 = int(cy + h / 2)
        else:
            continue

        base_label = pred.get("class", "hazard")
        if label_prefix:
            label = f"{label_prefix}:{base_label}"
        else:
            label = base_label

        text = f"{label} {conf:.2f}"

        cv2.rectangle(frame, (x1, y1), (x2, y2), color, 2)
        (text_w, text_h), _ = cv2.getTextSize(text, cv2.FONT_HERSHEY_SIMPLEX, 0.6, 2)
        cv2.rectangle(frame, (x1, y1 - text_h - 10), (x1 + text_w, y1), color, -1)
        cv2.putText(frame, text, (x1, y1 - 5), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (255, 255, 255), 2)

    return frame

# ============================================================================
# TRACKING UTILITIES
# ============================================================================

def iou(box1, box2):
    """Calculate IoU between two boxes [x1, y1, x2, y2]."""
    x1 = max(box1[0], box2[0])
    y1 = max(box1[1], box2[1])
    x2 = min(box1[2], box2[2])
    y2 = min(box1[3], box2[3])

    inter_w = max(0, x2 - x1)
    inter_h = max(0, y2 - y1)
    inter_area = inter_w * inter_h

    if inter_area == 0:
        return 0.0

    box1_area = (box1[2] - box1[0]) * (box1[3] - box1[1])
    box2_area = (box2[2] - box2[0]) * (box2[3] - box2[1])

    return inter_area / float(box1_area + box2_area - inter_area + 1e-9)

class SimpleTracker:
    """Simple IoU-based tracker for video processing."""

    def __init__(self, iou_threshold=0.3, max_missed=10):
        self.next_id = 1
        self.tracks = {}  # id -> {bbox, missed, label}
        self.iou_threshold = iou_threshold
        self.max_missed = max_missed

    def update(self, predictions, conf_threshold):
        """
        Update tracker with new predictions.

        Args:
            predictions: list from Roboflow
            conf_threshold: confidence threshold for filtering
        """
        new_boxes = []
        for pred in predictions:
            conf = float(pred.get("confidence", 0))
            if conf < conf_threshold:
                continue

            if all(k in pred for k in ("x", "y", "width", "height")):
                cx, cy, w, h = pred["x"], pred["y"], pred["width"], pred["height"]
                x1 = int(cx - w / 2)
                y1 = int(cy - h / 2)
                x2 = int(cx + w / 2)
                y2 = int(cy + h / 2)
                new_boxes.append({
                    "bbox": [x1, y1, x2, y2],
                    "label": pred.get("class", "hazard")
                })

        if len(self.tracks) == 0:
            for box in new_boxes:
                self.tracks[self.next_id] = {
                    "bbox": box["bbox"],
                    "missed": 0,
                    "label": box["label"]
                }
                self.next_id += 1
            return list(self.tracks.keys())

        if len(new_boxes) == 0:
            for tid in list(self.tracks.keys()):
                self.tracks[tid]["missed"] += 1
                if self.tracks[tid]["missed"] > self.max_missed:
                    del self.tracks[tid]
            return list(self.tracks.keys())

        track_ids = list(self.tracks.keys())
        matched_tracks = set()
        matched_boxes = set()

        for tid in track_ids:
            best_iou = 0
            best_idx = -1
            for idx, box in enumerate(new_boxes):
                if idx in matched_boxes:
                    continue
                curr_iou = iou(self.tracks[tid]["bbox"], box["bbox"])
                if curr_iou > best_iou and curr_iou > self.iou_threshold:
                    best_iou = curr_iou
                    best_idx = idx

            if best_idx >= 0:
                self.tracks[tid]["bbox"] = new_boxes[best_idx]["bbox"]
                self.tracks[tid]["missed"] = 0
                self.tracks[tid]["label"] = new_boxes[best_idx]["label"]
                matched_tracks.add(tid)
                matched_boxes.add(best_idx)
            else:
                self.tracks[tid]["missed"] += 1

        for idx, box in enumerate(new_boxes):
            if idx not in matched_boxes:
                self.tracks[self.next_id] = {
                    "bbox": box["bbox"],
                    "missed": 0,
                    "label": box["label"]
                }
                self.next_id += 1

        for tid in list(self.tracks.keys()):
            if self.tracks[tid]["missed"] > self.max_missed:
                del self.tracks[tid]

        return list(self.tracks.keys())

# ============================================================================
# VIDEO PROCESSING
# ============================================================================

def process_video(input_path, output_path):
    """
    Process video file with Roboflow detection and tracking
    using pothole, landslide and accident models.
    """
    cap = cv2.VideoCapture(input_path)

    fps = cap.get(cv2.CAP_PROP_FPS)
    width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
    height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
    total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))

    fourcc = cv2.VideoWriter_fourcc(*"mp4v")
    out = cv2.VideoWriter(output_path, fourcc, fps, (width, height))

    tracker_pothole = SimpleTracker()
    tracker_landslide = SimpleTracker()
    tracker_accident = SimpleTracker()

    frame_idx = 0
    processed_frames = 0

    total_risk_pothole = 0.0
    total_risk_landslide = 0.0
    total_risk_accident = 0.0

    all_track_ids_pothole = set()
    all_track_ids_landslide = set()
    all_track_ids_accident = set()

    print(f"[INFO] Processing video: {total_frames} frames at {fps} FPS")

    while True:
        ret, frame = cap.read()
        if not ret:
            break

        frame_idx += 1

        if frame_idx % FRAME_SKIP == 0:
            processed_frames += 1

            success, buffer = cv2.imencode('.jpg', frame, [cv2.IMWRITE_JPEG_QUALITY, 85])
            if not success:
                continue

            image_bytes = io.BytesIO(buffer.tobytes())

            # Pothole
            pothole_resp = call_roboflow_image(
                image_bytes,
                ROBOFLOW_POTHOLE_MODEL,
                ROBOFLOW_POTHOLE_API_KEY,
                timeout=30,
                retries=1
            )
            pothole_preds = pothole_resp.get("predictions", [])

            # Landslide
            image_bytes.seek(0)
            landslide_resp = call_roboflow_image(
                image_bytes,
                ROBOFLOW_LANDSLIDE_MODEL,
                ROBOFLOW_LANDSLIDE_API_KEY,
                timeout=90,
                retries=2
            )
            landslide_preds = landslide_resp.get("predictions", [])

            # Accident
            image_bytes.seek(0)
            accident_resp = call_roboflow_image(
                image_bytes,
                ROBOFLOW_ACCIDENT_MODEL,
                ROBOFLOW_ACCIDENT_API_KEY,
                timeout=60,
                retries=2
            )
            accident_preds = accident_resp.get("predictions", [])

            # Trackers & risk: pothole
            current_tracks_pothole = tracker_pothole.update(
                pothole_preds, CONF_THRESHOLD_POTHOLE
            )
            all_track_ids_pothole.update(current_tracks_pothole)

            for pred in pothole_preds:
                conf = float(pred.get("confidence", 0))
                if conf >= CONF_THRESHOLD_POTHOLE and all(k in pred for k in ("width", "height")):
                    area = pred["width"] * pred["height"]
                    total_risk_pothole += area / (width * height)

            # Trackers & risk: landslide
            current_tracks_landslide = tracker_landslide.update(
                landslide_preds, CONF_THRESHOLD_LANDSLIDE
            )
            all_track_ids_landslide.update(current_tracks_landslide)

            for pred in landslide_preds:
                conf = float(pred.get("confidence", 0))
                if conf >= CONF_THRESHOLD_LANDSLIDE and all(k in pred for k in ("width", "height")):
                    area = pred["width"] * pred["height"]
                    total_risk_landslide += area / (width * height)

            # Trackers & risk: accident
            current_tracks_accident = tracker_accident.update(
                accident_preds, CONF_THRESHOLD_ACCIDENT
            )
            all_track_ids_accident.update(current_tracks_accident)

            for pred in accident_preds:
                conf = float(pred.get("confidence", 0))
                if conf >= CONF_THRESHOLD_ACCIDENT and all(k in pred for k in ("width", "height")):
                    area = pred["width"] * pred["height"]
                    total_risk_accident += area / (width * height)

            # Draw boxes
            frame = draw_boxes_cv2(
                frame, pothole_preds, CONF_THRESHOLD_POTHOLE,
                color=(0, 0, 255), label_prefix="POT"
            )
            frame = draw_boxes_cv2(
                frame, landslide_preds, CONF_THRESHOLD_LANDSLIDE,
                color=(0, 255, 0), label_prefix="LND"
            )
            frame = draw_boxes_cv2(
                frame, accident_preds, CONF_THRESHOLD_ACCIDENT,
                color=(255, 0, 0), label_prefix="ACC"
            )

            if processed_frames % 10 == 0:
                print(f"[INFO] Processed {processed_frames} frames ({frame_idx}/{total_frames})")

        out.write(frame)

    cap.release()
    out.release()

    print(f"[INFO] Video processing complete: {processed_frames} frames analyzed")

    total_combined_risk = total_risk_pothole + total_risk_landslide + total_risk_accident
    risk_score = min((total_combined_risk / max(processed_frames, 1)) * 100, 100)

    return {
        "total_frames": total_frames,
        "processed_frames": processed_frames,
        "pothole_unique": len(all_track_ids_pothole),
        "landslide_unique": len(all_track_ids_landslide),
        "accident_unique": len(all_track_ids_accident),
        "pothole_risk": total_risk_pothole,
        "landslide_risk": total_risk_landslide,
        "accident_risk": total_risk_accident,
        "risk_score": risk_score
    }

# ============================================================================
# IMAGE PROCESSING
# ============================================================================

def process_image(input_path, output_path):
    """
    Process image file with Roboflow detection using
    pothole, landslide, and accident models.
    """
    frame = cv2.imread(input_path)
    if frame is None:
        return {
            "total_frames": 1,
            "processed_frames": 0,
            "pothole_unique": 0,
            "landslide_unique": 0,
            "accident_unique": 0,
            "pothole_risk": 0.0,
            "landslide_risk": 0.0,
            "accident_risk": 0.0,
            "risk_score": 0.0
        }

    height, width = frame.shape[:2]

    success, buffer = cv2.imencode('.jpg', frame, [cv2.IMWRITE_JPEG_QUALITY, 90])
    if not success:
        return {
            "total_frames": 1,
            "processed_frames": 0,
            "pothole_unique": 0,
            "landslide_unique": 0,
            "accident_unique": 0,
            "pothole_risk": 0.0,
            "landslide_risk": 0.0,
            "accident_risk": 0.0,
            "risk_score": 0.0
        }

    image_bytes = io.BytesIO(buffer.tobytes())

    # Pothole
    pothole_resp = call_roboflow_image(
        image_bytes,
        ROBOFLOW_POTHOLE_MODEL,
        ROBOFLOW_POTHOLE_API_KEY,
        timeout=30,
        retries=1
    )
    pothole_preds = pothole_resp.get("predictions", [])

    # Landslide
    image_bytes.seek(0)
    landslide_resp = call_roboflow_image(
        image_bytes,
        ROBOFLOW_LANDSLIDE_MODEL,
        ROBOFLOW_LANDSLIDE_API_KEY,
        timeout=90,
        retries=2
    )
    landslide_preds = landslide_resp.get("predictions", [])

    # Accident
    image_bytes.seek(0)
    accident_resp = call_roboflow_image(
        image_bytes,
        ROBOFLOW_ACCIDENT_MODEL,
        ROBOFLOW_ACCIDENT_API_KEY,
        timeout=60,
        retries=2
    )
    accident_preds = accident_resp.get("predictions", [])

    total_risk_pothole = 0.0
    total_risk_landslide = 0.0
    total_risk_accident = 0.0

    pothole_count = 0
    landslide_count = 0
    accident_count = 0

    for pred in pothole_preds:
        conf = float(pred.get("confidence", 0))
        if conf >= CONF_THRESHOLD_POTHOLE and all(k in pred for k in ("width", "height")):
            pothole_count += 1
            area = pred["width"] * pred["height"]
            total_risk_pothole += area / (width * height)

    for pred in landslide_preds:
        conf = float(pred.get("confidence", 0))
        if conf >= CONF_THRESHOLD_LANDSLIDE and all(k in pred for k in ("width", "height")):
            landslide_count += 1
            area = pred["width"] * pred["height"]
            total_risk_landslide += area / (width * height)

    for pred in accident_preds:
        conf = float(pred.get("confidence", 0))
        if conf >= CONF_THRESHOLD_ACCIDENT and all(k in pred for k in ("width", "height")):
            accident_count += 1
            area = pred["width"] * pred["height"]
            total_risk_accident += area / (width * height)

    frame = draw_boxes_cv2(
        frame, pothole_preds, CONF_THRESHOLD_POTHOLE,
        color=(0, 0, 255), label_prefix="POT"
    )
    frame = draw_boxes_cv2(
        frame, landslide_preds, CONF_THRESHOLD_LANDSLIDE,
        color=(0, 255, 0), label_prefix="LND"
    )
    frame = draw_boxes_cv2(
        frame, accident_preds, CONF_THRESHOLD_ACCIDENT,
        color=(255, 0, 0), label_prefix="ACC"
    )

    cv2.imwrite(output_path, frame)

    print(
        f"[INFO] Image processing complete: "
        f"{pothole_count} potholes, {landslide_count} landslides, {accident_count} accidents detected"
    )

    total_combined_risk = total_risk_pothole + total_risk_landslide + total_risk_accident
    risk_score = min(total_combined_risk * 100, 100)

    return {
        "total_frames": 1,
        "processed_frames": 1,
        "pothole_unique": pothole_count,
        "landslide_unique": landslide_count,
        "accident_unique": accident_count,
        "pothole_risk": total_risk_pothole,
        "landslide_risk": total_risk_landslide,
        "accident_risk": total_risk_accident,
        "risk_score": risk_score
    }

# ============================================================================
# FLASK ROUTES
# ============================================================================

@app.route("/upload_video", methods=["POST"])
def upload_video():
    """
    Upload and process video/image file.

    Request:
        - file or video: Video or image file (multipart/form-data)

    Returns:
        JSON with detection report
    """
    if "video" not in request.files and "file" not in request.files:
        return jsonify({"error": "No file uploaded"}), 400

    uploaded_file = request.files.get("video") or request.files.get("file")

    file_id = str(uuid.uuid4())
    original_filename = uploaded_file.filename
    ext = os.path.splitext(original_filename)[-1].lower()

    input_path = f"{file_id}_{original_filename}"
    uploaded_file.save(input_path)

    print(f"[INFO] Processing file: {original_filename} (ID: {file_id})")

    try:
        if ext in [".mp4", ".avi", ".mov", ".mkv"]:
            output_path = os.path.join(OUTPUT_DIR, f"{file_id}_detected.mp4")
            stats = process_video(input_path, output_path)
            file_type = "video"
        elif ext in [".jpg", ".jpeg", ".png", ".bmp"]:
            output_path = os.path.join(OUTPUT_DIR, f"{file_id}_detected{ext}")
            stats = process_image(input_path, output_path)
            file_type = "image"
        else:
            os.remove(input_path)
            return jsonify({"error": "Unsupported file format. Use MP4, AVI, MOV, JPG, or PNG"}), 400

        os.remove(input_path)

        pothole_unique = stats.get("pothole_unique", 0)
        landslide_unique = stats.get("landslide_unique", 0)
        accident_unique = stats.get("accident_unique", 0)

        pothole_risk = stats.get("pothole_risk", 0.0)
        landslide_risk = stats.get("landslide_risk", 0.0)
        accident_risk = stats.get("accident_risk", 0.0)

        if accident_unique > 0 or accident_risk > 0:
            hazard_detected = "accident"
        elif landslide_unique > 0 or landslide_risk > 0:
            hazard_detected = "landslide"
        elif pothole_unique > 0 or pothole_risk > 0:
            hazard_detected = "pothole"
        else:
            hazard_detected = "none"

        risk_score = round(stats.get("risk_score", 0.0), 2)

        report_data = {
            "file_id": file_id,
            "timestamp": datetime.utcnow().isoformat(),
            "file_type": file_type,
            "original_filename": original_filename,

            "hazard_detected": hazard_detected,
            "risk_score": risk_score,

            "pothole_unique": pothole_unique,
            "landslide_unique": landslide_unique,
            "accident_unique": accident_unique,
            "pothole_risk": pothole_risk,
            "landslide_risk": landslide_risk,
            "accident_risk": accident_risk,

            # Backwards-compatible
            "total_unique_potholes": pothole_unique,

            "total_frames": stats.get("total_frames", 0),
            "processed_frames": stats.get("processed_frames", 0),
            "output_file": output_path,

            "confidence_thresholds": {
                "pothole": CONF_THRESHOLD_POTHOLE,
                "landslide": CONF_THRESHOLD_LANDSLIDE,
                "accident": CONF_THRESHOLD_ACCIDENT,
            }
        }

        if db is not None:
            try:
                db.collection("reports").document(file_id).set(report_data)
                print(f"[INFO] Report saved to Firebase: {file_id}")
            except Exception as e:
                print(f"[ERROR] Failed to save to Firebase: {e}")

        return jsonify({"status": "success", "report": report_data}), 200

    except Exception as e:
        if os.path.exists(input_path):
            os.remove(input_path)
        print(f"[ERROR] Processing failed: {e}")
        return jsonify({"error": f"Processing failed: {str(e)}"}), 500

@app.route("/health", methods=["GET"])
def health():
    """Health check endpoint."""
    return jsonify({
        "status": "healthy",
        "models": {
            "pothole": {
                "model": ROBOFLOW_POTHOLE_MODEL,
                "threshold": CONF_THRESHOLD_POTHOLE
            },
            "landslide": {
                "model": ROBOFLOW_LANDSLIDE_MODEL,
                "threshold": CONF_THRESHOLD_LANDSLIDE
            },
            "accident": {
                "model": ROBOFLOW_ACCIDENT_MODEL,
                "threshold": CONF_THRESHOLD_ACCIDENT
            },
        },
        "firebase_connected": db is not None
    }), 200

# ============================================================================
# MAIN
# ============================================================================

def main():
    print("=" * 70)
    print("Video Upload Backend with Roboflow Detection")
    print("=" * 70)
    print("Models:")
    print(f"  Pothole  : {ROBOFLOW_POTHOLE_MODEL} (th={CONF_THRESHOLD_POTHOLE})")
    print(f"  Landslide: {ROBOFLOW_LANDSLIDE_MODEL} (th={CONF_THRESHOLD_LANDSLIDE})")
    print(f"  Accident : {ROBOFLOW_ACCIDENT_MODEL} (th={CONF_THRESHOLD_ACCIDENT})")
    print(f"Frame Skip: {FRAME_SKIP} (process every Nth frame)")
    print(f"Output Directory: {OUTPUT_DIR}")
    print(f"Firebase: {'Connected' if db else 'Not Connected'}")
    print("=" * 70)
    print("\nServer starting on http://0.0.0.0:8502")
    print("Endpoints:")
    print("  POST /upload_video - Upload video/image for detection")
    print("  GET  /health       - Health check")
    print("=" * 70)

    port = int(os.environ.get("PORT", 8502))
    app.run(host="0.0.0.0", port=port, threaded=True)

if __name__ == "__main__":
    main()
