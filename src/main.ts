import { supabase } from './supabaseClient';

// --- DOM ELEMENTS ---
const homeView = document.getElementById('home-view')!;
const gameView = document.getElementById('game-view')!;
const winView = document.getElementById('win-view')!;
const nameInput = document.getElementById('name-input') as HTMLInputElement;
const messageInput = document.getElementById('message-input') as HTMLTextAreaElement;
const designSelect = document.getElementById('design-select') as HTMLSelectElement;
const submitBtn = document.getElementById('submit-btn')!;
const playAgainBtn = document.getElementById('play-again-btn')!;
const timerDisplay = document.getElementById('timer-display')!;
const finalTimeDisplay = document.getElementById('final-time-display')!;
const leaderboardList = document.getElementById('leaderboard-list')!;
const gameBoard = document.getElementById('game-board')!;

// --- STATE ---
let currentUser = "";
let timerInterval: number;
let seconds = 0;
let flippedCards: HTMLElement[] = [];
let matchedPairs = 0;
const totalPairs = 8; 

// --- INITIALIZATION ---
function init() {
  const cookies = document.cookie.split(';');
  const userCookie = cookies.find(row => row.trim().startsWith('kryzz_player='));
  
  if (userCookie) {
    currentUser = userCookie.split('=')[1];
    showView(gameView);
    startNewGame();
  } else {
    showView(homeView);
  }
}

function showView(viewToShow: HTMLElement) {
  homeView.classList.add('hidden');
  gameView.classList.add('hidden');
  winView.classList.add('hidden');
  viewToShow.classList.remove('hidden');
}

// --- EVENT LISTENERS ---
submitBtn.addEventListener('click', async () => {
  const name = nameInput.value.trim();
  const message = messageInput.value.trim();
  const style = designSelect.value;

  if (!name || !message) {
    alert("Please enter a name and a message!");
    return;
  }

  submitBtn.innerText = "Saving...";
  submitBtn.disabled = true;

  // Save to Database
  await supabase.from('messages').insert([{ name, message_text: message, design_style: style }]);
  
  // Save Cookie
  document.cookie = `kryzz_player=${name}; max-age=31536000; path=/`;
  currentUser = name;

  showView(gameView);
  startNewGame();
});

playAgainBtn.addEventListener('click', () => {
  showView(gameView);
  startNewGame();
});

// --- GAME LOGIC ---
function startNewGame() {
  seconds = 0;
  matchedPairs = 0;
  flippedCards = [];
  timerDisplay.innerText = "0";
  gameBoard.innerHTML = "";
  
  // Generate pairs (For a real game, you'd pull messages from Supabase here)
  const emojis = ['🎂', '🎁', '🎈', '🎉', '🍰', '🌸', '✨', '🎀'];
  let cardsData = [...emojis, ...emojis];
  cardsData.sort(() => Math.random() - 0.5); // Shuffle

  cardsData.forEach(emoji => {
    const card = document.createElement('div');
    card.classList.add('card');
    card.dataset.image = emoji;
    card.innerHTML = `
      <div class="card-inner">
        <div class="card-front">Message!</div>
        <div class="card-back">${emoji}</div>
      </div>
    `;
    card.addEventListener('click', () => handleCardClick(card));
    gameBoard.appendChild(card);
  });

  clearInterval(timerInterval);
  timerInterval = setInterval(() => {
    seconds++;
    timerDisplay.innerText = seconds.toString();
  }, 1000);
}

function handleCardClick(card: HTMLElement) {
  if (flippedCards.length === 2 || card.classList.contains('matched') || card.classList.contains('flipped')) return;

  card.classList.add('flipped');
  flippedCards.push(card);

  if (flippedCards.length === 2) {
    const [card1, card2] = flippedCards;
    if (card1.dataset.image === card2.dataset.image) {
      setTimeout(() => {
        card1.classList.add('matched');
        card2.classList.add('matched');
        flippedCards = [];
        matchedPairs++;
        if (matchedPairs === totalPairs) handleWin();
      }, 800);
    } else {
      setTimeout(() => {
        card1.classList.remove('flipped');
        card2.classList.remove('flipped');
        flippedCards = [];
      }, 1000);
    }
  }
}

// --- WIN LOGIC ---
async function handleWin() {
  clearInterval(timerInterval);
  finalTimeDisplay.innerText = `Your Time is ${Math.floor(seconds / 60)}:${(seconds % 60).toString().padStart(2, '0')} minutes`;
  showView(winView);

  // Save to leaderboard
  await supabase.from('leaderboard').insert([{ name: currentUser, time_seconds: seconds }]);

  // Fetch and display leaderboard
  const { data } = await supabase.from('leaderboard').select('name, time_seconds').order('time_seconds', { ascending: true }).limit(5);
  
  leaderboardList.innerHTML = "";
  if (data) {
    data.forEach((entry, index) => {
      const li = document.createElement('li');
      const mins = Math.floor(entry.time_seconds / 60);
      const secs = (entry.time_seconds % 60).toString().padStart(2, '0');
      li.innerText = `${entry.name} - ${mins}:${secs}`;
      leaderboardList.appendChild(li);
    });
  }
}

// Start app
init();