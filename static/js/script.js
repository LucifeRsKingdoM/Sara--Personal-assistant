class SarahAssistant {
    constructor() {
        this.sessionId = null;
        this.isListening = false;
        this.isSpeaking = false;
        this.isActive = false;
        this.isProcessing = false;
        this.recognition = null;
        this.synthesis = window.speechSynthesis;
        this.thinkingMessageId = null;
        this.currentLanguage = 'english';
        this.voices = [];
        this.selectedVoice = null;
        
        // Language-specific wake words
        this.wakeWords = {
            english: ['sarah', 'hey sarah', 'hello sarah', 'hi sarah', 'hello sara', 'sara', 'hi sara', 'hey sara'],
            kannada: ['ಸಾರಾ', 'ಹೇ ಸಾರಾ', 'ಹಲೋ ಸಾರಾ', 'sarah', 'sara', 'ಸರ', 'ಹಾಯ್ ಸರ']
        };
        
        // Language-specific exit words
        this.exitWords = {
            english: ['bye', 'goodbye', 'bye bye', 'see you later'],
            kannada: ['ಬೈ', 'ಟಾಟಾ', 'ಗುಡ್ ಬೈ', 'bye', 'tata']
        };
        
        this.init();
    }

    init() {
        // Initialize speech synthesis FIRST - this is crucial!
        this.initializeSpeechSynthesis();
        this.initializeSpeechRecognition();
        this.bindEvents();
        this.updateDateTime();
        this.createNewSession();
        this.setupLanguageToggle();
        
        // Update time every second
        setInterval(() => this.updateDateTime(), 1000);
    }

    // Initialize speech synthesis immediately
    initializeSpeechSynthesis() {
        console.log('🎤 Initializing Speech Synthesis...');
        
        // Cancel any existing speech
        this.synthesis.cancel();
        
        // Load voices immediately
        this.loadVoices();
        
        // Handle voice changes (important for different browsers)
        this.synthesis.onvoiceschanged = () => {
            console.log('🔄 Voices changed, reloading...');
            this.loadVoices();
        };
        
        // Force voice loading if needed
        if (this.voices.length === 0) {
            setTimeout(() => this.loadVoices(), 100);
        }
    }

    loadVoices() {
        this.voices = this.synthesis.getVoices();
        console.log('🔊 Available voices:', this.voices.length);
        
        if (this.voices.length > 0) {
            this.selectVoiceForLanguage();
        }
    }

    selectVoiceForLanguage() {
        if (this.currentLanguage === 'kannada') {
            // Find Kannada voice
            this.selectedVoice = this.voices.find(voice => 
                voice.lang.includes('kn') || 
                voice.name.toLowerCase().includes('kannada')
            ) || this.voices.find(voice => voice.lang.includes('hi')) || this.voices[0];
        } else {
            // Find English voice (preferably female)
            this.selectedVoice = this.voices.find(voice => 
                voice.lang.includes('en') && 
                (voice.name.toLowerCase().includes('female') || voice.name.toLowerCase().includes('woman'))
            ) || this.voices.find(voice => voice.lang.includes('en')) || this.voices[0];
        }
        
        if (this.selectedVoice) {
            console.log('✅ Selected voice:', this.selectedVoice.name, 'Lang:', this.selectedVoice.lang);
        }
    }

    setupLanguageToggle() {
        const toggle = document.getElementById('language-toggle');
        const currentLangDisplay = document.getElementById('current-language');
        const toggleLabels = document.querySelectorAll('.toggle-label');
        
        toggle.addEventListener('change', () => {
            if (toggle.checked) {
                this.currentLanguage = 'kannada';
                currentLangDisplay.textContent = 'ಕನ್ನಡ Mode';
                toggleLabels[0].classList.remove('active');
                toggleLabels[1].classList.add('active');
                console.log('🌐 SWITCHED TO KANNADA MODE');
            } else {
                this.currentLanguage = 'english';
                currentLangDisplay.textContent = 'English Mode';
                toggleLabels[1].classList.remove('active');
                toggleLabels[0].classList.add('active');
                console.log('🌐 SWITCHED TO ENGLISH MODE');
            }
            
            // Reload voices for new language
            this.selectVoiceForLanguage();
            
            // Restart recognition with new language
            if (this.isListening) {
                this.stopListening();
                setTimeout(() => this.startListening(), 500);
            }
        });
        
        // Set initial state
        toggleLabels[0].classList.add('active');
    }

    initializeSpeechRecognition() {
        if ('webkitSpeechRecognition' in window) {
            this.recognition = new webkitSpeechRecognition();
        } else if ('SpeechRecognition' in window) {
            this.recognition = new SpeechRecognition();
        } else {
            console.error('Speech recognition not supported');
            return;
        }

        // Optimized settings for better conversation flow
        this.recognition.continuous = true;
        this.recognition.interimResults = false;
        this.recognition.maxAlternatives = 1;

        this.recognition.onstart = () => {
            this.isListening = true;
            console.log(`🎤 STARTED RECORDING (${this.currentLanguage.toUpperCase()})`);
            this.updateUI();
            this.updateStatus('Listening...');
        };

        this.recognition.onresult = (event) => {
            console.log('📝 GOT SPEECH RESULT');
            
            // Get the latest result
            const lastResultIndex = event.results.length - 1;
            const transcript = event.results[lastResultIndex][0].transcript.trim();
            console.log('📝 Transcript:', transcript);
            
            // Stop listening immediately when we get input
            this.stopListening();
            this.handleSpeechInput(transcript);
        };

        this.recognition.onerror = (event) => {
            console.error('❌ Speech recognition error:', event.error);
            this.isListening = false;
            this.updateUI();
            
            // Restart if still active and not speaking
            if (this.isActive && !this.isSpeaking && !this.isProcessing) {
                setTimeout(() => this.startListening(), 1000);
            }
        };

        this.recognition.onend = () => {
            console.log('🛑 RECORDING ENDED');
            this.isListening = false;
            this.updateUI();
        };
    }

    startListening() {
        if (!this.recognition || this.isListening || this.isSpeaking || this.isProcessing) {
            return;
        }
        
        // Don't start if speech synthesis is still speaking
        if (this.synthesis.speaking) {
            console.log('⚠️ Speech synthesis still active, delaying recognition start');
            setTimeout(() => this.startListening(), 500);
            return;
        }
        
        try {
            console.log(`🎤 ATTEMPTING TO START RECORDING (${this.currentLanguage.toUpperCase()})`);
            
            // Set language based on current mode
            this.recognition.lang = this.currentLanguage === 'kannada' ? 'kn-IN' : 'en-IN';
            this.recognition.start();
        } catch (error) {
            console.error('Error starting recognition:', error);
            setTimeout(() => this.startListening(), 1000);
        }
    }

    stopListening() {
        if (this.recognition && this.isListening) {
            console.log(`🛑 STOPPING RECORDING (${this.currentLanguage.toUpperCase()})`);
            this.recognition.stop();
            this.isListening = false;
        }
    }

    async handleSpeechInput(transcript) {
        console.log(`🗣️ PROCESSING SPEECH (${this.currentLanguage.toUpperCase()}):`, transcript);
        
        const lowerTranscript = transcript.toLowerCase();
        const currentWakeWords = this.wakeWords[this.currentLanguage];
        const currentExitWords = this.exitWords[this.currentLanguage];
        
        // Check for exit words first
        if (currentExitWords.some(word => lowerTranscript.includes(word))) {
            console.log('👋 EXIT WORD DETECTED');
            this.addMessage('user', transcript);
            
            const goodbyeMessage = this.currentLanguage === 'kannada' 
                ? "ಬೈ ಲೂಸಿಫರ್! ನಂತರ ಮಾತನಾಡೋಣ!" 
                : "Goodbye Lucifer! Talk to you later!";
                
            // Speak goodbye message and stop voice mode AFTER speech completes
            this.speakResponseImmediately(goodbyeMessage, true); // true indicates this is a goodbye
            return;
        }
        
        // Check for wake words (only if not already active)
        if (!this.isActive) {
            if (currentWakeWords.some(word => lowerTranscript.includes(word))) {
                console.log('👋 WAKE WORD DETECTED - ACTIVATING');
                this.isActive = true;
                this.updateUI();
                
                const greetingMessage = this.currentLanguage === 'kannada' 
                    ? "ಹೇ ಲೂಸಿಫರ್! ನಾನು ಇಲ್ಲಿದ್ದೇನೆ. ಏನು ಆಗಿದೆ?" 
                    : "Hey Lucifer! I'm here. What's up?";
                    
                this.speakResponseImmediately(greetingMessage);
                return;
            } else {
                console.log('⚠️ NO WAKE WORD - IGNORING');
                setTimeout(() => this.startListening(), 500);
                return;
            }
        } else {
            this.addMessage('user', transcript);
            this.processMessage(transcript);
        }
    }

    async processMessage(message) {
        this.isProcessing = true;
        console.log(`⚙️ PROCESSING MESSAGE (${this.currentLanguage.toUpperCase()})`);
        
        // Stop any ongoing speech immediately
        this.synthesis.cancel();
        
        // Stop recognition when processing starts
        if (this.recognition) {
            this.recognition.stop();
        }
        
        this.showThinkingMessage();
        this.updateStatus('Processing...');
        
        try {
            const response = await fetch('/chat', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    message: message,
                    session_id: this.sessionId,
                    language: this.currentLanguage
                })
            });
            
            const data = await response.json();
            
            if (data.error) {
                throw new Error(data.error);
            }
            
            this.sessionId = data.session_id;
            this.removeThinkingMessage();
            this.addMessage('sarah', data.response);
            
            console.log('📝 Response received, starting speech IMMEDIATELY...');
            
            // Start speaking IMMEDIATELY
            this.speakResponseImmediately(data.response);
            
        } catch (error) {
            console.error('❌ Error processing message:', error);
            this.removeThinkingMessage();
            
            const errorMessage = this.currentLanguage === 'kannada' 
                ? 'ಕ್ಷಮಿಸಿ ಲೂಸಿಫರ್, ನನಗೆ ಸ್ವಲ್ಪ ತೊಂದರೆ ಆಗುತ್ತಿದೆ. ಮತ್ತೆ ಪ್ರಯತ್ನಿಸಿ?' 
                : 'Sorry Lucifer, I\'m having some trouble right now. Can you try again?';
                
            this.addMessage('sarah', errorMessage);
            this.speakResponseImmediately(errorMessage);
        } finally {
            this.isProcessing = false;
            this.updateStatus(this.isActive ? 'Active' : 'Ready');
        }
    }

    // IMMEDIATE speech function - this is the key!
    speakResponseImmediately(text, isGoodbye = false) {
        this.isSpeaking = true;
        console.log(`🗣️ SPEECH STARTING IMMEDIATELY (${this.currentLanguage.toUpperCase()})`);
        this.updateUI();
        this.updateStatus('Speaking...');
        
        // Clean text for speech (remove emojis, special chars)
        let cleanText = text
            .replace(/\*/g, "")
            .replace(/[\p{Emoji_Presentation}\p{Extended_Pictographic}]/gu, "")
            .replace(/\.\s*/g, ", ")
            .replace(/[^\w\s\u0C80-\u0CFF.,!?]/g, ' ')
            .replace(/\s+/g, ' ')
            .trim();
        
        console.log('🧹 Cleaned text for speech:', cleanText);
        
        // Cancel any ongoing speech first
        this.synthesis.cancel();
        
        // Create utterance
        const utterance = new SpeechSynthesisUtterance(cleanText);
        
        // Set voice and language
        if (this.selectedVoice) {
            utterance.voice = this.selectedVoice;
        }
        
        utterance.lang = this.currentLanguage === 'kannada' ? 'kn-IN' : 'en-IN';
        
        // Optimize speech settings for natural conversation
        utterance.rate = 1.0; // Slightly faster for better flow
        utterance.pitch = 1.0;
        utterance.volume = 0.8;
        
        // Handle speech events
        utterance.onstart = () => {
            console.log('🎯 SPEECH ACTUALLY STARTED NOW!');
            // Ensure recognition is stopped when speaking starts
            if (this.recognition) {
                this.recognition.abort();
            }
        };
        
        utterance.onend = () => {
            console.log(`🔇 FINISHED SPEAKING (${this.currentLanguage.toUpperCase()})`);
            this.isSpeaking = false;
            this.updateUI();
            
            // If this was a goodbye message, stop voice mode now
            if (isGoodbye) {
                console.log('👋 GOODBYE SPEECH COMPLETED - STOPPING VOICE MODE NOW');
                setTimeout(() => {
                    this.stopVoiceMode();
                }, 500);
                return;
            }
            
            // Otherwise, restart listening after speech completes (normal flow)
            setTimeout(() => {
                if (this.isActive && !this.synthesis.speaking) {
                    console.log(`🔄 RESTARTING LISTENING AFTER SPEECH (${this.currentLanguage.toUpperCase()})`);
                    this.startListening();
                }
            }, 500);
        };
        
        utterance.onerror = (event) => {
            console.error('❌ Speech synthesis error:', event.error);
            this.isSpeaking = false;
            this.updateUI();
            
            // Handle goodbye case even if speech failed
            if (isGoodbye) {
                console.log('👋 GOODBYE SPEECH ERROR - STOPPING VOICE MODE ANYWAY');
                setTimeout(() => {
                    this.stopVoiceMode();
                }, 500);
                return;
            }
            
            // Still restart listening even if speech failed (normal flow)
            setTimeout(() => {
                if (this.isActive) {
                    this.startListening();
                }
            }, 500);
        };
        
        // This is the CRITICAL part - speak immediately!
        console.log('⚡ Calling synthesis.speak() RIGHT NOW');
        this.synthesis.speak(utterance);
        console.log('✅ synthesis.speak() called - speech should start NOW!');
    }

    showThinkingMessage() {
        const messagesContainer = document.getElementById('chat-messages');
        const thinkingDiv = document.createElement('div');
        thinkingDiv.className = 'message thinking-message';
        thinkingDiv.id = 'thinking-message';
        
        const thinkingText = this.currentLanguage === 'kannada' ? '🤔 ಯೋಚಿಸುತ್ತಿದ್ದೇನೆ...' : '🤔 Thinking...';
        
        thinkingDiv.innerHTML = `
            <div class="sarah-message">
                <div class="message-avatar">
                    <i class="fas fa-robot"></i>
                </div>
                <div class="message-content">
                    <p>${thinkingText}</p>
                    <span class="timestamp">Just now</span>
                </div>
            </div>
        `;
        
        messagesContainer.appendChild(thinkingDiv);
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
        this.thinkingMessageId = thinkingDiv.id;
    }

    removeThinkingMessage() {
        const thinkingMessage = document.getElementById('thinking-message');
        if (thinkingMessage) {
            thinkingMessage.remove();
        }
    }

    bindEvents() {
        // Voice control buttons
        document.getElementById('start-voice-btn').addEventListener('click', () => {
            this.startVoiceMode();
        });

        document.getElementById('stop-voice-btn').addEventListener('click', () => {
            this.stopVoiceMode();
        });

        // Text input
        document.getElementById('text-input').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                this.sendTextMessage();
            }
        });

        document.getElementById('send-text-btn').addEventListener('click', () => {
            this.sendTextMessage();
        });

        // System prompts
        document.getElementById('add-prompt-btn').addEventListener('click', () => {
            this.addSystemPrompt();
        });

        // Session controls
        document.getElementById('new-session-btn').addEventListener('click', () => {
            this.createNewSession();
        });

        document.getElementById('clear-history-btn').addEventListener('click', () => {
            this.clearHistory();
        });

        // Voice settings
        document.getElementById('speech-rate').addEventListener('input', (e) => {
            document.getElementById('rate-value').textContent = e.target.value;
        });

        document.getElementById('speech-volume').addEventListener('input', (e) => {
            document.getElementById('volume-value').textContent = e.target.value;
        });
    }

    startVoiceMode() {
        console.log(`🚀 VOICE MODE ACTIVATED (${this.currentLanguage.toUpperCase()})`);
        this.isActive = false; // Will be activated by wake word
        this.updateUI();
        this.updateStatus('Listening for wake word...');
        this.startListening();
    }

    stopVoiceMode() {
        console.log(`🛑 VOICE MODE STOPPED (${this.currentLanguage.toUpperCase()})`);
        this.isActive = false;
        this.isListening = false;
        this.isSpeaking = false;
        this.isProcessing = false;
        
        if (this.recognition) {
            this.recognition.stop();
        }
        
        // Cancel any ongoing speech
        this.synthesis.cancel();
        
        this.removeThinkingMessage();
        this.updateUI();
        this.updateStatus('Voice mode stopped');
    }

    updateUI() {
        const startBtn = document.getElementById('start-voice-btn');
        const stopBtn = document.getElementById('stop-voice-btn');
        const voiceStatus = document.getElementById('voice-status');
        const visualizer = document.getElementById('voice-visualizer');

        if (this.isActive || this.isListening) {
            startBtn.style.display = 'none';
            stopBtn.style.display = 'flex';
            
            if (this.isListening) {
                const listenText = this.currentLanguage === 'kannada' 
                    ? '🎤 ಕೇಳುತ್ತಿದ್ದೇನೆ... (ಈಗ ಮಾತನಾಡಿ)'
                    : '🎤 Listening... (Speak now)';
                voiceStatus.innerHTML = `<p>${listenText}</p>`;
                visualizer.classList.add('listening');
                document.body.classList.add('listening');
            } else if (this.isSpeaking) {
                const speakText = this.currentLanguage === 'kannada' 
                    ? '🗣️ ಸಾರಾ ಮಾತನಾಡುತ್ತಿದ್ದಾಳೆ...'
                    : '🗣️ Sarah is speaking...';
                voiceStatus.innerHTML = `<p>${speakText}</p>`;
                visualizer.classList.remove('listening');
                document.body.classList.add('speaking');
            } else if (this.isProcessing) {
                const processText = this.currentLanguage === 'kannada' 
                    ? '⏳ ಪ್ರೋಸೆಸ್ ಮಾಡುತ್ತಿದ್ದೇನೆ...'
                    : '⏳ Processing...';
                voiceStatus.innerHTML = `<p>${processText}</p>`;
                visualizer.classList.remove('listening');
                document.body.classList.add('processing');
            } else {
                const readyText = this.currentLanguage === 'kannada' 
                    ? '🔄 ಮುಂದಿನ ಇನ್‌ಪುಟ್‌ಗಾಗಿ ಸಿದ್ಧ...'
                    : '🔄 Ready for next input...';
                voiceStatus.innerHTML = `<p>${readyText}</p>`;
                visualizer.classList.remove('listening');
            }
        } else {
            startBtn.style.display = 'flex';
            stopBtn.style.display = 'none';
            
            const startText = this.currentLanguage === 'kannada' 
                ? 'ಕ್ಲಿಕ್ ಮಾಡಿ "Start Listening" ಮತ್ತು "ಹೇ ಸಾರಾ" ಎಂದು ಹೇಳಿ'
                : 'Click "Start Listening" and say "Hey Sarah" to begin';
            voiceStatus.innerHTML = `<p>${startText}</p>`;
            visualizer.classList.remove('listening');
            document.body.classList.remove('listening', 'speaking', 'processing');
        }
    }

    updateDateTime() {
        const now = new Date();
        const dateOptions = { 
            weekday: 'long', 
            year: 'numeric', 
            month: 'long', 
            day: 'numeric' 
        };
        const timeOptions = { 
            hour: '2-digit', 
            minute: '2-digit', 
            second: '2-digit' 
        };

        document.getElementById('current-date').textContent = now.toLocaleDateString('en-US', dateOptions);
        document.getElementById('current-time').textContent = now.toLocaleTimeString('en-US', timeOptions);
    }

    updateStatus(status) {
        document.getElementById('session-status').textContent = status;
        
        const indicator = document.getElementById('status-indicator');
        indicator.className = 'status-indicator';
        
        if (status.includes('Listening')) {
            indicator.classList.add('listening');
        } else if (status.includes('Speaking')) {
            indicator.classList.add('speaking');
        } else if (status.includes('Processing')) {
            indicator.classList.add('processing');
        }
    }

    async sendTextMessage() {
        const input = document.getElementById('text-input');
        const message = input.value.trim();
        
        if (!message) return;
        
        input.value = '';
        this.addMessage('user', message);
        this.processMessage(message);
    }

    addMessage(sender, content) {
        const messagesContainer = document.getElementById('chat-messages');
        const messageDiv = document.createElement('div');
        messageDiv.className = 'message';
        
        const timestamp = new Date().toLocaleTimeString('en-US', {
            hour: '2-digit',
            minute: '2-digit'
        });
        
        if (sender === 'user') {
            messageDiv.innerHTML = `
                <div class="user-message">
                    <div class="message-avatar">
                        <i class="fas fa-user"></i>
                    </div>
                    <div class="message-content">
                        <p>${this.escapeHtml(content)}</p>
                        <span class="timestamp">${timestamp}</span>
                    </div>
                </div>
            `;
        } else {
            messageDiv.innerHTML = `
                <div class="sarah-message">
                    <div class="message-avatar">
                        <i class="fas fa-robot"></i>
                    </div>
                    <div class="message-content">
                        <p>${this.escapeHtml(content)}</p>
                        <span class="timestamp">${timestamp}</span>
                    </div>
                </div>
            `;
        }
        
        messagesContainer.appendChild(messageDiv);
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    async createNewSession() {
        try {
            const response = await fetch('/new_session', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                }
            });
            
            const data = await response.json();
            this.sessionId = data.session_id;
            
            // Clear chat messages with language-appropriate welcome
            const messagesContainer = document.getElementById('chat-messages');
            const welcomeText = this.currentLanguage === 'kannada' 
                ? 'ಹೇ ಲೂಸಿಫರ್! 👋 ನಾನು ಸಾರಾ, ನಿಮ್ಮ ವೈಯಕ್ತಿಕ ಸಹಾಯಕ. "ಹೇ ಸಾರಾ" ಎಂದು ಹೇಳಿ!'
                : 'Hey Lucifer! 👋 I\'m Sarah, your personal assistant. Say "Hey Sarah" to start talking with me!';
                
            messagesContainer.innerHTML = `
                <div class="welcome-message">
                    <div class="sarah-message">
                        <div class="message-avatar">
                            <i class="fas fa-robot"></i>
                        </div>
                        <div class="message-content">
                            <p>${welcomeText}</p>
                            <span class="timestamp">Just now</span>
                        </div>
                    </div>
                </div>
            `;
            
            this.updateStatus('New session created');
            console.log('✅ NEW SESSION CREATED:', this.sessionId);
            
        } catch (error) {
            console.error('❌ Error creating new session:', error);
        }
    }

    clearHistory() {
        const messagesContainer = document.getElementById('chat-messages');
        const clearText = this.currentLanguage === 'kannada' 
            ? 'ಇತಿಹಾಸ ತೆರವುಗೊಳಿಸಲಾಗಿದೆ! ಹೊಸದಾಗಿ ಪ್ರಾರಂಭಿಸಲು ಸಿದ್ಧ, ಲೂಸಿಫರ್!'
            : 'History cleared! Ready to start fresh, Lucifer!';
            
        messagesContainer.innerHTML = `
            <div class="welcome-message">
                <div class="sarah-message">
                    <div class="message-avatar">
                        <i class="fas fa-robot"></i>
                    </div>
                    <div class="message-content">
                        <p>${clearText}</p>
                        <span class="timestamp">Just now</span>
                    </div>
                </div>
            </div>
        `;
        console.log('🗑️ HISTORY CLEARED');
    }

    async addSystemPrompt() {
        const promptInput = document.getElementById('custom-prompt');
        const promptText = promptInput.value.trim();
        
        if (!promptText) return;
        
        try {
            const response = await fetch('/add_system_prompt', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    prompt: promptText
                })
            });
            
            const data = await response.json();
            
            if (data.success) {
                promptInput.value = '';
                console.log('✅ SYSTEM PROMPT ADDED');
            }
            
        } catch (error) {
            console.error('❌ Error adding system prompt:', error);
        }
    }

    // Browser compatibility check
    checkBrowserCompatibility() {
        const issues = [];
        
        if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
            issues.push('Speech Recognition not supported');
        }
        
        if (!('speechSynthesis' in window)) {
            issues.push('Speech Synthesis not supported');
        }
        
        if (!('fetch' in window)) {
            issues.push('Fetch API not supported');
        }
        
        if (issues.length > 0) {
            console.warn('⚠️ Browser compatibility issues:', issues.join(', '));
        }
        
        return issues.length === 0;
    }

    // Keyboard shortcuts
    initKeyboardShortcuts() {
        document.addEventListener('keydown', (event) => {
            // Spacebar to toggle listening (when not in input field)
            if (event.code === 'Space' && event.target.tagName !== 'INPUT' && event.target.tagName !== 'TEXTAREA') {
                event.preventDefault();
                if (this.isActive) {
                    this.stopVoiceMode();
                } else {
                    this.startVoiceMode();
                }
            }
            
            // Escape to stop voice mode
            if (event.key === 'Escape') {
                this.stopVoiceMode();
            }
        });
    }

    // Load conversation history
    async loadConversationHistory() {
        if (!this.sessionId) return;
        
        try {
            const response = await fetch(`/conversation_history/${this.sessionId}`);
            const history = await response.json();
            
            console.log('📚 Loaded conversation history:', history.length, 'items');
            
        } catch (error) {
            console.error('❌ Error loading conversation history:', error);
        }
    }
}

// Additional CSS for notifications and animations
const additionalCSS = `
    .error-notification, .success-notification {
        position: fixed;
        top: 20px;
        right: 20px;
        padding: 15px 20px;
        border-radius: 10px;
        color: white;
        font-weight: 500;
        z-index: 1001;
        animation: slideInRight 0.5s ease-out;
        max-width: 400px;
    }

    .error-notification {
        background: linear-gradient(45deg, #ef4444, #dc2626);
    }

    .success-notification {
        background: linear-gradient(45deg, #4ade80, #22c55e);
    }

    .error-content, .success-content {
        display: flex;
        align-items: center;
        gap: 10px;
    }

    @keyframes slideInRight {
        from {
            opacity: 0;
            transform: translateX(100px);
        }
        to {
            opacity: 1;
            transform: translateX(0);
        }
    }

    /* Thinking message animation */
    .thinking-message .message-content {
        position: relative;
    }

    .thinking-message .message-content p {
        animation: thinking 1.5s ease-in-out infinite;
    }

    @keyframes thinking {
        0%, 100% {
            opacity: 0.7;
        }
        50% {
            opacity: 1;
            transform: scale(1.02);
        }
    }

    /* Force hide loading overlay */
    .loading-overlay {
        display: none !important;
    }
`;

// Add additional CSS to document
const styleSheet = document.createElement('style');
styleSheet.textContent = additionalCSS;
document.head.appendChild(styleSheet);

// Initialize Sarah Assistant when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    console.log('🚀 DOM LOADED - Initializing Sarah Assistant...');
    
    // Create global instance
    window.sarah = new SarahAssistant();
    
    // Check browser compatibility
    if (sarah.checkBrowserCompatibility()) {
        console.log('✅ Browser compatibility check passed');
    }
    
    // Initialize keyboard shortcuts
    sarah.initKeyboardShortcuts();
    
    // Load conversation history after a delay
    setTimeout(() => {
        sarah.loadConversationHistory();
    }, 1000);
    
    console.log('🎉 SARAH ASSISTANT FULLY INITIALIZED AND READY!');
});

// Handle page visibility changes
document.addEventListener('visibilitychange', () => {
    if (document.hidden && window.sarah && window.sarah.isActive) {
        console.log('📱 Tab hidden - pausing voice mode');
        window.sarah.stopVoiceMode();
    }
});

// Handle before unload
window.addEventListener('beforeunload', (event) => {
    if (window.sarah && window.sarah.isActive) {
        event.preventDefault();
        event.returnValue = 'Sarah is still active. Are you sure you want to leave?';
    }
});

// Global error handler for unhandled errors
window.addEventListener('error', (event) => {
    console.error('🚨 Global error:', event.error);
    
    // Try to recover gracefully
    if (window.sarah) {
        window.sarah.synthesis.cancel();
        if (window.sarah.recognition) {
            window.sarah.recognition.stop();
        }
    }
});

// Handle speech synthesis errors globally
window.addEventListener('unhandledrejection', (event) => {
    console.error('🚨 Unhandled promise rejection:', event.reason);
    event.preventDefault();
});

// Utility functions for debugging
window.debugSarah = {
    // Get current state
    getState: () => {
        if (!window.sarah) return 'Not initialized';
        return {
            isListening: window.sarah.isListening,
            isSpeaking: window.sarah.isSpeaking,
            isActive: window.sarah.isActive,
            isProcessing: window.sarah.isProcessing,
            currentLanguage: window.sarah.currentLanguage,
            sessionId: window.sarah.sessionId,
            voicesCount: window.sarah.voices.length,
            selectedVoice: window.sarah.selectedVoice?.name
        };
    },
    
    // Force stop everything
    emergencyStop: () => {
        if (window.sarah) {
            window.sarah.stopVoiceMode();
            window.sarah.synthesis.cancel();
            console.log('🛑 Emergency stop executed');
        }
    },
    
    // Test speech immediately
    testSpeech: (text = 'Hello, this is a test') => {
        if (window.sarah) {
            window.sarah.speakResponseImmediately(text);
        }
    },
    
    // List available voices
    listVoices: () => {
        if (window.sarah) {
            console.table(window.sarah.voices.map(v => ({
                name: v.name,
                lang: v.lang,
                localService: v.localService,
                default: v.default
            })));
        }
    }
};

console.log('🔧 Debug utilities available: window.debugSarah');
console.log('   - debugSarah.getState() - Get current state');
console.log('   - debugSarah.emergencyStop() - Stop everything');
console.log('   - debugSarah.testSpeech() - Test speech synthesis');
console.log('   - debugSarah.listVoices() - List available voices');