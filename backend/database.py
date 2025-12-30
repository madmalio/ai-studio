import sqlite3
import datetime

DB_NAME = "studio_history.db"

def init_db():
    """Creates the tables if they don't exist."""
    conn = sqlite3.connect(DB_NAME)
    c = conn.cursor()
    
    # 1. History Table (Generated Images/Videos)
    c.execute('''
        CREATE TABLE IF NOT EXISTS history (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            type TEXT,
            url TEXT,
            prompt TEXT,
            camera TEXT,
            lens TEXT,
            focal_length TEXT,
            timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    ''')

    # 2. NEW: Uploads Table (Source Images)
    # Warning: Storing base64 in DB is okay for local prototype, 
    # but bad for production (use file storage (S3) instead).
    c.execute('''
        CREATE TABLE IF NOT EXISTS uploads (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            base64_data TEXT,
            timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    ''')
    
    conn.commit()
    conn.close()

# --- History Functions ---
def save_item(media_type, url, prompt, camera, lens, focal_length=None):
    conn = sqlite3.connect(DB_NAME)
    c = conn.cursor()
    c.execute(
        "INSERT INTO history (type, url, prompt, camera, lens, focal_length) VALUES (?, ?, ?, ?, ?, ?)",
        (media_type, url, prompt, camera, lens, focal_length)
    )
    conn.commit()
    conn.close()

def get_history():
    conn = sqlite3.connect(DB_NAME)
    conn.row_factory = sqlite3.Row
    c = conn.cursor()
    c.execute("SELECT * FROM history ORDER BY id DESC LIMIT 50")
    rows = c.fetchall()
    conn.close()
    history_list = []
    for row in rows:
        item = dict(row)
        if item.get('focal_length') is None: item['focal_length'] = 'N/A'
        history_list.append(item)
    return history_list

# --- NEW: Upload Functions ---
def save_upload(base64_data):
    conn = sqlite3.connect(DB_NAME)
    c = conn.cursor()
    c.execute("INSERT INTO uploads (base64_data) VALUES (?)", (base64_data,))
    conn.commit()
    conn.close()

def get_uploads():
    conn = sqlite3.connect(DB_NAME)
    conn.row_factory = sqlite3.Row
    c = conn.cursor()
    c.execute("SELECT * FROM uploads ORDER BY id DESC LIMIT 50")
    rows = c.fetchall()
    conn.close()
    return [dict(row) for row in rows]