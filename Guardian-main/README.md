# Guardian – AI Powered Disaster & Road Hazard Detection 🚁🛡️

## Overview
**Guardian** is an AI-powered drone surveillance system designed to detect and analyze road hazards and disaster situations in real time. The system processes **live video streams from drones** and uses **Machine Learning (YOLOv8)** models to identify dangerous situations such as **potholes, road accidents, and landslides**.

The project combines **Computer Vision, Real-Time Streaming, Mobile Application Development, and Cloud Services** to provide a **smart monitoring solution for road safety and disaster management**.

---

## Features

- 🚁 Drone-based monitoring system for real-time surveillance  
- 🧠 AI-powered detection using YOLOv8 models  
- ⚠️ Detects:
  - Road **Potholes**
  - **Accidents**
  - **Landslides**
- 📡 Live video streaming using RTSP protocol  
- 📱 Mobile application interface built with React Native  
- ☁️ Cloud backend & authentication using Firebase  
- 📊 Generates risk scores based on detected hazards  

---

## Tech Stack

### Frontend (Mobile Application)
- React Native

### Backend
- Python
- Flask API

### Machine Learning
- YOLOv8 (Object Detection)
- OpenCV
- NumPy
- Pandas

### Cloud & Services
- Firebase (Authentication & Database)

### Streaming
- RTSP (Real-Time Streaming Protocol)

---

## System Architecture

The Guardian system works through the following pipeline:

1️⃣ **Drone captures live video feed**

2️⃣ **RTSP protocol streams video** to the backend server

3️⃣ **Backend processes frames using YOLOv8 models**

4️⃣ Models detect:
- potholes
- accidents
- landslides

5️⃣ The system calculates a **risk score**

6️⃣ Results are sent to the **React Native mobile application**

7️⃣ Users receive **alerts and visual detection results**

---

## Machine Learning Models

### 🛣️ Pothole Detection Model
Detects damaged road surfaces and potholes to prevent accidents.

### 🚗 Accident Detection Model
Identifies road accidents from drone footage for faster emergency response.

### ⛰️ Landslide Detection Model
Detects landslides or blocked roads in hilly or disaster-prone areas.

---
## Installation & Setup

### 1️⃣ Clone the Repository
```bash
git clone https://github.com/Abhishek142004/Guardian.git
cd Guardian
```
### 2️⃣ Backend Setup (Flask)
```bash
cd Guardian-server
python new-app.py
python new-video-server.py
```
### 3️⃣ Mobile App Setup (React Native)
```bash
cd Guardian
npm run expo start
```

### Use Cases

-🚧 Smart City Road Monitoring

-🚨 Accident Detection & Emergency Response

-⛰️ Disaster Monitoring in Landslide-Prone Areas

-🛰️ Infrastructure Inspection

-🚁 Drone-Based Surveillance Systems

### Future Enhancements

-📍 GPS-based hazard mapping

-🔔 Real-time alert notifications

-🧠 Edge AI processing directly on drones

-☁️ Cloud-based analytics dashboard



Author

Abhishek Yadav

Major Project – Guardian: AI-Based Disaster & Road Hazard Detection System
