from __future__ import annotations
import io
import os
import cv2
import numpy as np
from PIL import Image


def decode_qr(image_path: str) -> list[str]:
    """
    Detect and decode QR codes. Handles PDF, PNG, JPG, WEBP.
    Returns list of decoded strings (empty if none found).
    """
    images = _load_all_pages(image_path)
    urls: list[str] = []

    for img in images:
        _scan_image(img, image_path, urls)

    return urls


def _scan_image(img: np.ndarray, original_path: str, urls: list[str]) -> None:
    # Strategy 1: OpenCV QRCodeDetector
    detector = cv2.QRCodeDetector()
    data, _, _ = detector.detectAndDecode(img)
    if data and data.strip() not in urls:
        urls.append(data.strip())

    # Strategy 2: WeChatQRCode
    try:
        wechat = cv2.wechat_qrcode_WeChatQRCode()
        texts, _ = wechat.detectAndDecode(img)
        for t in texts:
            if t and t.strip() not in urls:
                urls.append(t.strip())
    except Exception:
        pass

    # Strategy 3: pyzbar — works best on raster images
    try:
        from pyzbar.pyzbar import decode as pyzbar_decode
        pil = Image.fromarray(cv2.cvtColor(img, cv2.COLOR_BGR2RGB))
        for d in pyzbar_decode(pil):
            text = d.data.decode('utf-8', errors='ignore').strip()
            if text and text not in urls:
                urls.append(text)
    except Exception:
        pass


def _load_all_pages(path: str) -> list[np.ndarray]:
    ext = os.path.splitext(path)[1].lower()
    if ext == '.pdf':
        try:
            import fitz
            doc    = fitz.open(path)
            images = []
            for page in doc:
                mat = fitz.Matrix(2, 2)
                pix = page.get_pixmap(matrix=mat, alpha=False)
                pil = Image.open(io.BytesIO(pix.tobytes("png"))).convert("RGB")
                images.append(cv2.cvtColor(np.array(pil), cv2.COLOR_RGB2BGR))
            return images
        except Exception:
            return []

    img = cv2.imread(path)
    if img is None:
        try:
            pil = Image.open(path).convert('RGB')
            img = cv2.cvtColor(np.array(pil), cv2.COLOR_RGB2BGR)
        except Exception:
            return []
    return [img]
