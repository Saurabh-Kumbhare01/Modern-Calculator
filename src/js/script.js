// Sound Synthesis Setup (Web Audio API)
const AudioContext = window.AudioContext || window.webkitAudioContext;
let audioCtx;
let soundEnabled = true;

// Synthesize a clean, premium click sound
function playClickSound() {
    if (!soundEnabled) return;
    if (!audioCtx) audioCtx = new AudioContext();
    if (audioCtx.state === 'suspended') audioCtx.resume();
    
    const oscillator = audioCtx.createOscillator();
    const gainNode = audioCtx.createGain();
    
    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(600, audioCtx.currentTime);
    oscillator.frequency.exponentialRampToValueAtTime(300, audioCtx.currentTime + 0.04);
    
    gainNode.gain.setValueAtTime(0.05, audioCtx.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.04);
    
    oscillator.connect(gainNode);
    gainNode.connect(audioCtx.destination);
    
    oscillator.start();
    oscillator.stop(audioCtx.currentTime + 0.04);
}

// App State
let expression = '';
let currentInput = '0';
let isEvaluated = false;
let history = JSON.parse(localStorage.getItem('calcHistory')) || [];

// References to DOM Elements
const currentOperandEl = document.getElementById('current-operand');
const previousOperandEl = document.getElementById('previous-operand');
const errorEl = document.getElementById('error-message');
const historyList = document.getElementById('history-list');
const historyPanel = document.getElementById('history-panel');
const sciPanel = document.getElementById('scientific-panel');

// Bootstrap Application
renderHistory();
initTheme();

// ----------------------------------------------------
// UI Logic & Toggles
// ----------------------------------------------------

function initTheme() {
    const themeBtn = document.getElementById('toggle-theme');
    const savedTheme = localStorage.getItem('theme');
    
    if (savedTheme === 'light') {
        document.documentElement.classList.remove('dark');
        themeBtn.querySelector('i').classList.replace('fa-moon', 'fa-sun');
    }
    
    themeBtn.addEventListener('click', () => {
        playClickSound();
        const isDark = document.documentElement.classList.toggle('dark');
        const icon = themeBtn.querySelector('i');
        
        if (isDark) {
            icon.classList.replace('fa-sun', 'fa-moon');
            localStorage.setItem('theme', 'dark');
        } else {
            icon.classList.replace('fa-moon', 'fa-sun');
            localStorage.setItem('theme', 'light');
        }
    });
}

const soundBtn = document.getElementById('toggle-sound');
soundBtn.addEventListener('click', () => {
    soundEnabled = !soundEnabled;
    const icon = soundBtn.querySelector('i');
    if (soundEnabled) {
        soundBtn.classList.add('text-primary');
        icon.classList.replace('fa-volume-xmark', 'fa-volume-high');
        playClickSound();
    } else {
        soundBtn.classList.remove('text-primary');
        icon.classList.replace('fa-volume-high', 'fa-volume-xmark');
    }
});

document.getElementById('toggle-history').addEventListener('click', () => {
    playClickSound();
    if(window.innerWidth < 768) {
        historyPanel.classList.toggle('hidden');
        setTimeout(() => historyPanel.classList.toggle('show-mobile'), 10);
    } else {
        historyPanel.classList.toggle('hidden');
    }
});

document.getElementById('close-history').addEventListener('click', () => {
    playClickSound();
    historyPanel.classList.remove('show-mobile');
    setTimeout(() => {
        historyPanel.classList.add('hidden');
    }, 300);
});

document.getElementById('clear-history').addEventListener('click', () => {
    playClickSound();
    history = [];
    saveHistory();
    renderHistory();
});

document.getElementById('toggle-sci').addEventListener('click', () => {
    playClickSound();
    sciPanel.classList.toggle('mobile-show-grid');
    const icon = document.querySelector('#toggle-sci i');
    if (sciPanel.classList.contains('mobile-show-grid')) {
        icon.classList.replace('fa-flask', 'fa-chevron-up');
    } else {
        icon.classList.replace('fa-chevron-up', 'fa-flask');
    }
});

// ----------------------------------------------------
// Calculator Core Logic
// ----------------------------------------------------

function updateDisplay() {
    let displayStr = currentInput;
    
    // Scale font size down for large strings to prevent overflow visually
    if(displayStr.length > 12 && !displayStr.includes('(')) {
        currentOperandEl.style.fontSize = '2rem';
    } else {
        currentOperandEl.style.fontSize = '';
    }
    
    currentOperandEl.innerText = displayStr || '0';
    previousOperandEl.innerText = expression;
    
    // Force auto-scroll to the end of input
    currentOperandEl.scrollLeft = currentOperandEl.scrollWidth;
}

function showError(msg) {
    errorEl.innerText = msg;
    errorEl.style.opacity = '1';
    setTimeout(() => {
        errorEl.style.opacity = '0';
    }, 2000);
}

const actionMap = {
    'delete': () => {
        if(isEvaluated) return;
        currentInput = currentInput.length > 1 ? currentInput.slice(0, -1) : '0';
    },
    'clear': () => {
        currentInput = '0';
        expression = '';
        isEvaluated = false;
    },
    'equals': () => {
        if(!currentInput || (currentInput === '0' && !expression)) return;
        
        try {
            let evalStr = expression + currentInput;
            
            // Standardize string for math.js parsing
            evalStr = evalStr.replace(/×/g, '*').replace(/÷/g, '/').replace(/−/g, '-');
            if (evalStr.trim() === '') return;

            // Evaluate utilizing robust Math.js engine
            const result = math.evaluate(evalStr);
            
            // Handle edge cases
            if (!isFinite(result) || isNaN(result)) throw new Error("Math Error");

            // Format to 14 decimal places to avoid standard JS floating point bugs
            const formattedResult = math.format(result, { precision: 14 });
            
            addToHistory(expression + currentInput, formattedResult);
            
            expression = evalStr.replace(/\*/g, '×').replace(/\//g, '÷') + ' =';
            currentInput = String(formattedResult);
            isEvaluated = true;
            
        } catch (error) {
            showError('Invalid Expression');
            console.error(error);
        }
    },
    
    // Standard Operators
    'add': () => appendOperator('+'),
    'subtract': () => appendOperator('−'),
    'multiply': () => appendOperator('×'),
    'divide': () => appendOperator('÷'),
    
    // Scientific Operations
    'sin': () => appendFunction('sin('),
    'cos': () => appendFunction('cos('),
    'tan': () => appendFunction('tan('),
    'asin': () => appendFunction('asin('),
    'acos': () => appendFunction('acos('),
    'atan': () => appendFunction('atan('),
    'log': () => appendFunction('log10('),
    'ln': () => appendFunction('log('),
    'exp': () => appendFunction('exp('),
    'sqrt': () => appendFunction('sqrt('),
    'cbrt': () => appendFunction('cbrt('),
    'power': () => appendOperator('^'),
    'pi': () => appendNumber('pi'),
    'e': () => appendNumber('e'),
    'factorial': () => appendFunction('!'),
    'open-paren': () => appendFunction('('),
    'close-paren': () => appendFunction(')'),
    'percent': () => appendOperator('%'),
};

function appendOperator(op) {
    if(isEvaluated) {
        expression = currentInput + ' ' + op + ' ';
        currentInput = '0';
        isEvaluated = false;
    } else {
        if(currentInput !== '0' && currentInput !== '') {
            expression += currentInput + ' ' + op + ' ';
            currentInput = '0';
        } else if(expression.length > 0) {
            // Hot-swap the last inserted operator
            expression = expression.slice(0, -3) + ' ' + op + ' ';
        }
    }
}

function appendFunction(fn) {
    if(isEvaluated) {
        currentInput = fn;
        expression = '';
        isEvaluated = false;
    } else {
        if(currentInput === '0') currentInput = fn;
        else currentInput += fn;
    }
}

function appendNumber(num) {
    if(isEvaluated) {
        currentInput = num;
        expression = '';
        isEvaluated = false;
    } else {
        if(currentInput === '0' && num !== '.') {
            currentInput = num;
        } else {
            if(num === '.' && currentInput.includes('.')) {
                // Prevent multiple decimals in the current operand chunk
                const parts = currentInput.split(/[\+\-\×\÷\(\)]/);
                const lastPart = parts[parts.length - 1];
                if(lastPart.includes('.')) return;
            }
            currentInput += num;
        }
    }
}

// ----------------------------------------------------
// Event Listeners
// ----------------------------------------------------

document.querySelectorAll('.calc-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        playClickSound();
        const action = btn.dataset.action;
        const number = btn.dataset.number;
        
        if(number !== undefined) {
            appendNumber(number);
        } else if(action && actionMap[action]) {
            actionMap[action]();
        }
        updateDisplay();
    });
});

document.addEventListener('keydown', (e) => {
    const key = e.key;
    if(e.ctrlKey || e.metaKey || e.altKey) return;
    
    const keyMap = {
        'Enter': 'equals',
        '=': 'equals',
        'Backspace': 'delete',
        'Escape': 'clear',
        '+': 'add',
        '-': 'subtract',
        '*': 'multiply',
        '/': 'divide',
        '^': 'power',
        '%': 'percent',
        '(': 'open-paren',
        ')': 'close-paren',
        '!': 'factorial'
    };

    if(/^[0-9.]$/.test(key)) {
        e.preventDefault();
        playClickSound();
        appendNumber(key);
        updateDisplay();
        
        const btn = document.querySelector(`[data-number="${key}"]`);
        if(btn) animateButton(btn);
    } else if(keyMap[key]) {
        e.preventDefault();
        playClickSound();
        actionMap[keyMap[key]]();
        updateDisplay();
        
        const btn = document.querySelector(`[data-action="${keyMap[key]}"]`);
        if(btn) animateButton(btn);
    }
});

function animateButton(btn) {
    btn.classList.add('scale-95', 'bg-white/40');
    setTimeout(() => {
        btn.classList.remove('scale-95', 'bg-white/40');
    }, 100);
}

// ----------------------------------------------------
// LocalStorage History
// ----------------------------------------------------

function addToHistory(eq, res) {
    history.unshift({ eq, res });
    if(history.length > 30) history.pop(); 
    saveHistory();
    renderHistory();
}

function saveHistory() {
    localStorage.setItem('calcHistory', JSON.stringify(history));
}

function renderHistory() {
    if(history.length === 0) {
        historyList.innerHTML = `
            <div class="h-full flex flex-col items-center justify-center text-slate-400 dark:text-slate-500 opacity-50 mt-10">
                <i class="fa-solid fa-ghost text-4xl mb-3"></i>
                <p class="text-sm font-medium">No history yet</p>
            </div>`;
        return;
    }
    
    historyList.innerHTML = history.map((item, index) => `
        <div class="history-item group" data-index="${index}">
            <div class="history-equation text-xs text-slate-500 dark:text-slate-400 text-right font-display truncate">${item.eq}</div>
            <div class="history-result text-lg font-bold text-slate-800 dark:text-white text-right font-display group-hover:text-primary transition-colors">${item.res}</div>
        </div>
    `).join('');
    
    document.querySelectorAll('.history-item').forEach(item => {
        item.addEventListener('click', () => {
            playClickSound();
            const idx = item.dataset.index;
            const hist = history[idx];
            currentInput = String(hist.res);
            expression = '';
            isEvaluated = false;
            updateDisplay();
            
            if(window.innerWidth < 768) {
                historyPanel.classList.remove('show-mobile');
                setTimeout(() => historyPanel.classList.add('hidden'), 300);
            }
        });
    });
}
