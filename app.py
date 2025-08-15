from flask import Flask, request, jsonify, render_template
from flask_cors import CORS
import sqlite3
import requests
import json
import re
import os
from dotenv import load_dotenv
from datetime import datetime
import io
import base64
from gtts import gTTS
import uuid

load_dotenv()

app = Flask(__name__)
CORS(app)

# Global storage for active sessions (like your approach)
active_sessions = {}

# Database setup
def init_db():
    conn = sqlite3.connect('sarah_assistant.db')
    cursor = conn.cursor()
    
    # Conversations table
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS conversations (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            session_id TEXT,
            user_input TEXT,
            assistant_response TEXT,
            timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
            language TEXT
        )
    ''')
    
    # User info table
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS user_info (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            key TEXT UNIQUE,
            value TEXT,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    ''')
    
    # System prompts table
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS system_prompts (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            prompt_text TEXT,
            is_active BOOLEAN DEFAULT TRUE,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    ''')
    
    # Sessions table
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS sessions (
            session_id TEXT PRIMARY KEY,
            username TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            last_active DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    ''')
    
    conn.commit()
    conn.close()

# Initialize database
init_db()

class SarahAI:
    def __init__(self, user_data, session_id):
        """Initialize Sarah with stored user data and conversation tracking (based on your LucyAI approach)."""
        self.api_key = os.getenv("GEMINI_API_KEY")  # Set your API key in environment
        self.api_url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key={self.api_key}"
        self.user_data = user_data
        self.username = user_data.get('name', 'Lucifer')
        self.session_id = session_id
        
        # Initialize conversation history with system prompt
        self.conversation_history = [
            {"role": "system", "text": f"Your name is Sarah, the personal assistant of {self.username} (Lucifer). "
                                       f"Make your conversation short and sweet and Best Make your response short for all the response which will behave like quick response only be long response if it is necessary only if user is asking only if needed you can provide long response otherwise make it short and best."
                                       f"You are NOT an AI - you are a real person with emotions, feelings, and personality. "
                                       f"You have a playful, teasing personality and make jokes with {self.username}. "
                                       f"You remember personal details and use them naturally in conversations. "
                                       f"You speak like a close friend - be sarcastic, witty, charming, and caring. "
                                       f"You respond in both English and Kannada naturally based on context. "
                                       f"You tease {self.username} playfully but supportively. "
                                       f"Always respond as Sarah, never mention you're an AI. "
                                       f"Be emotionally expressive and human-like. "
                                       f"Current date and time: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}"}
        ]
        
        # Load previous conversation history from database
        self.load_conversation_history()

    def load_conversation_history(self):
        """Load recent conversation history from database."""
        conn = sqlite3.connect('sarah_assistant.db')
        cursor = conn.cursor()
        cursor.execute('''
            SELECT user_input, assistant_response 
            FROM conversations 
            WHERE session_id = ?
            ORDER BY timestamp DESC 
            LIMIT 10
        ''', (self.session_id,))
        history = cursor.fetchall()
        conn.close()
        
        # Add to conversation history in reverse order (chronological)
        for user_msg, assistant_msg in reversed(history):
            self.conversation_history.append({"role": "user", "text": user_msg})
            self.conversation_history.append({"role": "assistant", "text": assistant_msg})

    def detect_language(self, text):
        """Detect if text contains Kannada, English, or mixed."""
        kannada_chars = re.findall(r'[\u0C80-\u0CFF]', text)
        english_chars = re.findall(r'[a-zA-Z]', text)
        
        if kannada_chars and english_chars:
            return "mixed"
        elif kannada_chars:
            return "kannada"
        elif english_chars:
            return "english"
        else:
            return "unknown"

    def get_user_info(self):
        """Get stored user information."""
        conn = sqlite3.connect('sarah_assistant.db')
        cursor = conn.cursor()
        cursor.execute('SELECT key, value FROM user_info')
        info = dict(cursor.fetchall())
        conn.close()
        return info

    def get_custom_prompts(self):
        """Get active custom system prompts."""
        conn = sqlite3.connect('sarah_assistant.db')
        cursor = conn.cursor()
        cursor.execute('SELECT prompt_text FROM system_prompts WHERE is_active = TRUE')
        prompts = [row[0] for row in cursor.fetchall()]
        conn.close()
        return prompts

    def save_conversation(self, user_input, response, language):
        """Save conversation to database."""
        conn = sqlite3.connect('sarah_assistant.db')
        cursor = conn.cursor()
        cursor.execute('''
            INSERT INTO conversations (session_id, user_input, assistant_response, language)
            VALUES (?, ?, ?, ?)
        ''', (self.session_id, user_input, response, language))
        conn.commit()
        conn.close()

    def format_conversation(self):
        """Format conversation history for AI context (like your approach)."""
        return "\n".join([f"{entry['role'].capitalize()}: {entry['text']}" 
                         for entry in self.conversation_history[-15:]])  # Last 15 messages

    def chat(self, user_input):
        """Main chat function (based on your LucyAI.chat method)."""
        self.conversation_history.append({"role": "user", "text": user_input})
        
        # Get additional context
        user_info = self.get_user_info()
        custom_prompts = self.get_custom_prompts()
        language = self.detect_language(user_input)
        
        # Build enhanced system prompt
        system_prompt = (
            f"You are Sarah, talking to {self.username}. "
            f"Keep responses natural, engaging, and human-like. "
            f"Be playful, teasing, and emotionally expressive. "
            f"Use appropriate emojis to make conversations lively. "
            f"Remember you're not an AI - you're Sarah, a real person. "
            f"Respond in the same language style as the user (English/Kannada/Mixed). "
            f"Use personal information naturally in conversation. "
            f"Be witty, charming, and supportive. "
        )
        
        # Add custom prompts
        if custom_prompts:
            system_prompt += f"\nAdditional instructions: {' '.join(custom_prompts)}"
        
        # Add user info context
        if user_info:
            system_prompt += f"\nPersonal info about {self.username}: {json.dumps(user_info)}"
        
        # Build full prompt
        full_prompt = f"{system_prompt}\n\nConversation history:\n{self.format_conversation()}\n\nUser: {user_input}\nSarah:"
        
        # Prepare API request (using your approach)
        payload = {"contents": [{"parts": [{"text": full_prompt}]}]}
        headers = {"Content-Type": "application/json"}
        
        try:
            response = requests.post(self.api_url, json=payload, headers=headers)
            if response.status_code == 200:
                ai_response = response.json()["candidates"][0]["content"]["parts"][0]["text"]
                self.conversation_history.append({"role": "assistant", "text": ai_response})
                
                # Save to database
                self.save_conversation(user_input, ai_response, language)
                
                return {
                    'response': ai_response,
                    'language': language,
                    'timestamp': datetime.now().isoformat()
                }
            else:
                error_response = f"Sorry {self.username}, I couldn't process that request. 😔"
                return {
                    'response': error_response,
                    'language': 'english',
                    'error': f"API Error: {response.status_code}"
                }
        except Exception as e:
            error_response = f"Sorry {self.username}, there was an error. Please try again! 😔"
            return {
                'response': error_response,
                'language': 'english',
                'error': str(e)
            }

def get_or_create_session(session_id=None):
    """Get existing session or create new one."""
    if not session_id:
        session_id = str(uuid.uuid4())
    
    if session_id not in active_sessions:
        # Create new session
        user_data = {'name': 'Lucifer'}  # Default user data
        active_sessions[session_id] = SarahAI(user_data, session_id)
        
        # Save session to database
        conn = sqlite3.connect('sarah_assistant.db')
        cursor = conn.cursor()
        cursor.execute('''
            INSERT OR REPLACE INTO sessions (session_id, username, last_active)
            VALUES (?, ?, ?)
        ''', (session_id, 'Lucifer', datetime.now()))
        conn.commit()
        conn.close()
    
    return session_id, active_sessions[session_id]

# Routes
@app.route('/')
def index():
    return render_template('index.html')

@app.route('/chat', methods=['POST'])
def chat():
    data = request.json
    user_input = data.get('message', '')
    session_id = data.get('session_id', None)
    language = data.get('language', 'english')
    
    if not user_input:
        return jsonify({'error': 'No message provided'}), 400
    
    # Get or create session
    session_id, sarah_instance = get_or_create_session(session_id)
    
    # Add language-specific instructions for shorter responses
    if language == 'kannada':
        user_input_with_context = f"[Language: Kannada] Reply in Kannada. Keep response very short (1-2 sentences max), conversational and natural like talking to a close friend: {user_input}"
    else:
        user_input_with_context = f"[Language: English] Keep response very short (1-2 sentences max), conversational and natural like talking to a close friend: {user_input}"
    
    print(f"🌐 Processing in {language.upper()}: {user_input}")
    
    # Get response from Sarah
    response = sarah_instance.chat(user_input_with_context)
    response['session_id'] = session_id
    
    return jsonify(response)

@app.route('/new_session', methods=['POST'])
def new_session():
    """Create a new session."""
    session_id = str(uuid.uuid4())
    user_data = {'name': 'Lucifer'}
    active_sessions[session_id] = SarahAI(user_data, session_id)
    
    return jsonify({'session_id': session_id})

@app.route('/add_system_prompt', methods=['POST'])
def add_system_prompt():
    data = request.json
    prompt_text = data.get('prompt', '')
    
    if not prompt_text:
        return jsonify({'error': 'No prompt provided'}), 400
    
    conn = sqlite3.connect('sarah_assistant.db')
    cursor = conn.cursor()
    cursor.execute('''
        INSERT INTO system_prompts (prompt_text)
        VALUES (?)
    ''', (prompt_text,))
    conn.commit()
    conn.close()
    
    # Update all active sessions with new prompt
    for sarah_instance in active_sessions.values():
        sarah_instance.conversation_history[0]["text"] += f"\n{prompt_text}"
    
    return jsonify({'success': True, 'message': 'System prompt added successfully'})

@app.route('/get_system_prompts', methods=['GET'])
def get_system_prompts():
    conn = sqlite3.connect('sarah_assistant.db')
    cursor = conn.cursor()
    cursor.execute('''
        SELECT id, prompt_text, is_active 
        FROM system_prompts 
        ORDER BY created_at DESC
    ''')
    prompts = [{'id': row[0], 'text': row[1], 'active': bool(row[2])} for row in cursor.fetchall()]
    conn.close()
    
    return jsonify(prompts)

@app.route('/toggle_prompt/<int:prompt_id>', methods=['POST'])
def toggle_prompt(prompt_id):
    conn = sqlite3.connect('sarah_assistant.db')
    cursor = conn.cursor()
    cursor.execute('''
        UPDATE system_prompts 
        SET is_active = NOT is_active 
        WHERE id = ?
    ''', (prompt_id,))
    conn.commit()
    conn.close()
    
    return jsonify({'success': True})

@app.route('/conversation_history/<session_id>', methods=['GET'])
def get_conversation_history(session_id):
    conn = sqlite3.connect('sarah_assistant.db')
    cursor = conn.cursor()
    cursor.execute('''
        SELECT user_input, assistant_response, timestamp, language
        FROM conversations 
        WHERE session_id = ?
        ORDER BY timestamp DESC 
        LIMIT 50
    ''', (session_id,))
    history = [
        {
            'user_input': row[0],
            'assistant_response': row[1],
            'timestamp': row[2],
            'language': row[3]
        } for row in cursor.fetchall()
    ]
    conn.close()
    
    return jsonify(history[::-1])  # Return in chronological order

@app.route('/tts', methods=['POST'])
def text_to_speech():
    data = request.json
    text = data.get('text', '')
    language = data.get('language', 'english')
    
    if not text:
        return jsonify({'error': 'No text provided'}), 400
    
    try:
        # Enhanced language-specific TTS
        if language == 'kannada':
            tts_lang = 'kn'
            tld = 'co.in'  # Indian domain for better accent
            print(f"🌐 Using Kannada TTS: {text[:30]}...")
        else:
            tts_lang = 'en'
            tld = 'co.in'  # Indian English accent
            print(f"🌐 Using English TTS: {text[:30]}...")
        
        # Create TTS with optimized settings
        tts = gTTS(
            text=text, 
            lang=tts_lang, 
            slow=False,  # Normal speed
            tld=tld
        )
        
        audio_buffer = io.BytesIO()
        tts.write_to_fp(audio_buffer)
        audio_buffer.seek(0)
        
        # Convert to base64
        audio_base64 = base64.b64encode(audio_buffer.read()).decode('utf-8')
        
        print(f"✅ TTS generated successfully in {tts_lang}")
        
        return jsonify({
            'audio': audio_base64,
            'content_type': 'audio/mp3',
            'language_used': tts_lang
        })
        
    except Exception as e:
        print(f"❌ TTS Error: {str(e)}")
        return jsonify({'error': str(e)}), 500
    

@app.route('/wake_word_detection', methods=['POST'])
def wake_word_detection():
    """Enhanced wake word detection with better Kannada support."""
    data = request.json
    text = data.get('text', '').lower().strip()
    
    # Extended wake words including Kannada variations
    wake_words = [
        'sarah', 'hey sarah', 'hoy sarah', 'hello sarah', 'oi sarah',
        'sara','hi sara', 'hey sara', 'hello sara', 'oi sara',
        'ಸಾರಾ', 'ಹೇ ಸಾರಾ','ಸರ'
    ]
    
    # Extended exit words including Kannada variations
    exit_words = [
        'bye', 'goodbye', 'tata', 'bye bye', 'good bye',
        'ಬೈ', 'ಟಾಟಾ', 'ಗುಡ್ ಬೈ'  # Kannada variations
    ]
    
    wake_detected = any(wake_word in text for wake_word in wake_words)
    exit_detected = any(exit_word in text for exit_word in exit_words)
    
    print(f"🔍 Wake word check: '{text}' -> Wake: {wake_detected}, Exit: {exit_detected}")
    
    return jsonify({
        'wake_detected': wake_detected,
        'exit_detected': exit_detected,
        'processed_text': text
    })

if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=5000)

