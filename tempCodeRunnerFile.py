from flask import Flask, request, jsonify, render_template, send_from_directory
from flask_cors import CORS
from googletrans import Translator
from gtts import gTTS
import os
import datetime
from flask_sqlalchemy import SQLAlchemy
import json

app = Flask(__name__, 
    static_folder='static',      # Specify the static folder
    template_folder='templates'  # Specify the templates folder
)
CORS(app)
translator = Translator()

# Define absolute paths
BASE_DIR = os.path.abspath(os.path.dirname(__file__))
TRANSLATIONS_DIR = os.path.join(BASE_DIR, "translations")
app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///cmc.db'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
db = SQLAlchemy(app)

# Ensure translations directory exists
os.makedirs(TRANSLATIONS_DIR, exist_ok=True)
class Folder(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False)
    audios = db.relationship('Audio', backref='folder', lazy=True)

class Audio(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False)
    file_path = db.Column(db.String(200), nullable=False)
    folder_id = db.Column(db.Integer, db.ForeignKey('folder.id'), nullable=False)


# Route for the main page
@app.route('/')
def index():
    print("Rendering index page")  # Debug print
    return render_template('index.html')

# Route for all static files
@app.route('/static/<path:filename>')
def serve_static(filename):
    return send_from_directory(app.static_folder, filename)

@app.route('/audio/<path:filename>')
def serve_audio(filename):
    return send_from_directory(TRANSLATIONS_DIR, filename)
# add routes for folders
@app.route('/folders')
def folders():
    return render_template('folders.html')
@app.route('/get-sidebar-folders')
def get_sidebar_folders():
    folders = Folder.query.all()
    return jsonify([{
        'id': folder.id,
        'name': folder.name
    } for folder in folders])

@app.route('/get-folders')
def get_folders():
    folders = Folder.query.all()
    return jsonify([{
        'id': folder.id,
        'name': folder.name,
        'audios': [{
            'id': audio.id,
            'name': audio.name,
            'file_path': audio.file_path
        } for audio in folder.audios]
    } for folder in folders])

@app.route('/create-folder', methods=['POST'])
def create_folder():
    data = request.json
    new_folder = Folder(name=data['name'])
    db.session.add(new_folder)
    db.session.commit()
    return jsonify({'success': True})

@app.route('/edit-folder/<int:folder_id>', methods=['PUT'])
def edit_folder(folder_id):
    folder = Folder.query.get_or_404(folder_id)
    data = request.json
    folder.name = data['name']
    db.session.commit()
    return jsonify({'success': True})

@app.route('/delete-folder/<int:folder_id>', methods=['DELETE'])
def delete_folder(folder_id):
    folder = Folder.query.get_or_404(folder_id)
    db.session.delete(folder)
    db.session.commit()
    return jsonify({'success': True})

@app.route('/save-audio', methods=['POST'])
def save_audio():
    data = request.json
    new_audio = Audio(
        name=data['name'],
        file_path=data['audioPath'],
        folder_id=data['folderId']
    )
    db.session.add(new_audio)
    db.session.commit()
    return jsonify({'success': True})
@app.route('/contact')
def contact():
    return render_template('contact.html')

@app.route('/translate', methods=['POST'])
def translate():
    try:
        data = request.json
        script = data.get('script')
        languages = data.get('languages')

        if not script or not languages:
            return jsonify({"error": "Script and languages are required"}), 400

        timestamp = datetime.datetime.now().strftime("%Y%m%d_%H%M%S")
        results = []

        for lang in languages:
            try:
                translation = translator.translate(script, dest=lang).text
                audio_filename = f'audio_{timestamp}_{lang}.mp3'
                audio_path = os.path.join(TRANSLATIONS_DIR, audio_filename)

                tts = gTTS(text=translation, lang=lang)
                tts.save(audio_path)

                results.append({
                    "language": lang,
                    "translation": translation,
                    "audio_file": f'/audio/{audio_filename}'
                })
            except Exception as e:
                print(f"Error processing language {lang}: {str(e)}")
                results.append({
                    "language": lang,
                    "error": str(e)
                })

        return jsonify({"results": results})

    except Exception as e:
        print(f"Translation error: {str(e)}")
        return jsonify({"error": str(e)}), 500
    
with app.app_context():
    db.create_all()
if __name__ == '__main__':
    print(f"Static folder: {app.static_folder}")       # Debug print
    print(f"Template folder: {app.template_folder}")   # Debug print
    app.run(debug=True, port=5001)