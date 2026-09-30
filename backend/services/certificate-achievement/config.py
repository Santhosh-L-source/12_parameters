import os

class Config:
    SECRET_KEY = os.environ.get('SECRET_KEY', 'cert-verify-secret-2024')
    UPLOAD_FOLDER = os.path.join(os.path.dirname(__file__), 'uploads')
    MAX_CONTENT_LENGTH = 16 * 1024 * 1024
    ALLOWED_EXTENSIONS = {'png', 'jpg', 'jpeg', 'webp', 'pdf'}
    REQUEST_TIMEOUT = 15
    MENTOR_PASSWORD = 'mentor@123'   # change this
    SCRAPE_HEADERS = {
        'User-Agent': (
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) '
            'AppleWebKit/537.36 (KHTML, like Gecko) '
            'Chrome/124.0.0.0 Safari/537.36'
        )
    }

DEPARTMENTS = [
    'Computer Science & Engineering',
    'Information Technology',
    'Electronics & Communication',
    'Electrical Engineering',
    'Mechanical Engineering',
    'Civil Engineering',
    'Artificial Intelligence & ML',
    'Data Science',
    'Cyber Security',
    'Other',
]

SEMESTERS = ['1', '2', '3', '4', '5', '6', '7', '8']
