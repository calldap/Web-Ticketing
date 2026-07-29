"""
EventTix — Sistem Ticketing & Manajemen Event
Universitas AMIKOM Yogyakarta
Mata Kuliah: Pemrograman Web

Backend server menggunakan Flask (Python).
Menjalankan aplikasi: python app.py
"""

from flask import Flask, render_template

app = Flask(__name__)


# ── Route Utama ──────────────────────────────────────────────
@app.route('/')
def index():
    """Halaman utama aplikasi EventTix."""
    return render_template('index.html')


# ── Jalankan Server ──────────────────────────────────────────
if __name__ == '__main__':
    print('=' * 50)
    print('🎫 EventTix — Sistem Ticketing & Event')
    print('   Universitas AMIKOM Yogyakarta')
    print('=' * 50)
    print('🌐 Buka di browser: http://127.0.0.1:5000')
    print('   Tekan Ctrl+C untuk menghentikan server')
    print('=' * 50)
    app.run(debug=True, port=5000)
