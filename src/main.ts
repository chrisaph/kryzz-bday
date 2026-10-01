import { supabase } from './supabaseClient';

// --- DOM ELEMENTS ---
const homeView = document.getElementById('home-view')!;
const gameView = document.getElementById('game-view')!;
const winView = document.getElementById('win-view')!;
const nameInput = document.getElementById('name-input') as HTMLInputElement;
const messageInput = document.getElementById('message-input') as HTMLTextAreaElement;
const designSelect = document.getElementById('design-select') as HTMLSelectElement;
const submitBtn = document.getElementById('submit-btn') as HTMLButtonElement;
const playAgainBtn = document.getElementById('play-again-btn')!;
const cardCountSelect = document.getElementById('card-count-select') as HTMLSelectElement;

const timerDisplay = document.getElementById('timer-display')!;
const finalTimeDisplay = document.getElementById('final-time-display')!;
const leaderboardList = document.getElementById('leaderboard-list')!;
const gameBoard = document.getElementById('game-board')!;
const leftMessagesContainer = document.getElementById('left-messages')!;
const rightMessagesContainer = document.getElementById('right-messages')!;

// --- STATE ---
let currentUser = "";
let timerInterval: number;
let seconds = 0;
let flippedCards: HTMLElement[] = [];
let matchedPairs = 0;
let totalPossiblePairs = 0; 
let currentCardModeText = "";

const availableEmojis = ['🎂','🎁','🎈','🎉','🍰','🌸','✨','🎀','💖','🥰','⭐','🥳','🎵','🌷','🍦','🍓'];

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

  await supabase.from('messages').insert([{ name, message_text: message, design_style: style }]);
  
  document.cookie = `kryzz_player=${name}; max-age=31536000; path=/`;
  currentUser = name;

  showView(gameView);
  startNewGame();
});

playAgainBtn.addEventListener('click', () => {
  showView(gameView);
  startNewGame();
});

cardCountSelect.addEventListener('change', () => {
  startNewGame();
});

// --- GAME LOGIC ---
// --- GAME LOGIC ---
async function startNewGame() {
  seconds = 0;
  matchedPairs = 0;
  flippedCards = [];
  timerDisplay.innerText = "0";
  gameBoard.innerHTML = "Loading cards...";
  leftMessagesContainer.innerHTML = "";
  rightMessagesContainer.innerHTML = "";
  clearInterval(timerInterval);

  // 1. Fetch real messages from DB
  const { data: dbMessages, error } = await supabase.from('messages').select('*');
  let playMessages = dbMessages ? [...dbMessages] : [];

  if (error) {
    console.error("Error fetching messages:", error);
  }

  // 2. Apply rules and fill empty slots with "Someone"
  if (cardCountSelect.value !== 'all') {
    const targetCardCount = parseInt(cardCountSelect.value); // 16 or 32
    
    // If we have more real messages than the limit, cut them down
    if (playMessages.length > targetCardCount) {
      playMessages = playMessages.slice(0, targetCardCount);
    }
    
    // If we have fewer real messages, fill the rest with "Someone"
    let fakeIdCounter = 1;
    while (playMessages.length < targetCardCount) {
      playMessages.push({
        id: `fake-${fakeIdCounter++}`,
        name: "Someone",
        message_text: "Happy Birthday Kryzz! 💖",
        design_style: "peach-c2" // Added default style here
      });
    }
    currentCardModeText = `${targetCardCount} cards`; // e.g., "16 cards" or "32 cards"
  } else {
    // If "All Cards" is selected, ensure the total is an even number so every card has a match
    if (playMessages.length % 2 !== 0) {
      playMessages.push({
        id: 'fake-even-pad',
        name: "Someone",
        message_text: "Happy Birthday Kryzz! 💖",
        design_style: "peach-c2"
      });
    }
    // Fallback if the database is literally empty
    if (playMessages.length === 0) {
      playMessages.push(
        { id: 'fake-1', name: "Someone", message_text: "Happy Birthday Kryzz! 💖" },
        { id: 'fake-2', name: "Someone", message_text: "Hope you have a great day!" }
      );
    }
    currentCardModeText = `All (${playMessages.length} cards)`; // e.g., "All (24 cards)"
  }

  // Calculate total possible pairs 
  totalPossiblePairs = Math.floor(playMessages.length / 2);

  // 3. Assign emojis in pairs to the selected messages
  let gameCardsData = [];
  
  for (let i = 0; i < playMessages.length; i++) {
    // Every 2 messages get the same emoji to form a match
    const assignedEmoji = availableEmojis[Math.floor(i / 2) % availableEmojis.length];
    gameCardsData.push({
      id: playMessages[i].id,
      name: playMessages[i].name,
      message: playMessages[i].message_text,
      style: playMessages[i].design_style || 'peach-c2', // Pull style from DB
      emoji: assignedEmoji
    });
  }

  // Shuffle the board
  gameCardsData.sort(() => Math.random() - 0.5);

  // 4. Render cards
  gameBoard.innerHTML = "";
  gameCardsData.forEach(data => {
    const card = document.createElement('div');
    card.classList.add('card');
    card.dataset.emoji = data.emoji;
    card.dataset.name = data.name;
    card.dataset.message = data.message;
    card.dataset.style = data.style; // Save style to the HTML element
    
    card.innerHTML = `
      <div class="card-inner">
        <div class="card-front">${data.name}</div>
        <div class="card-back">${data.emoji}</div>
      </div>
    `;
    card.addEventListener('click', () => handleCardClick(card));
    gameBoard.appendChild(card);
  });

  // Start Timer
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
    
    // They match if they have the same assigned hidden emoji
    if (card1.dataset.emoji === card2.dataset.emoji) {
      setTimeout(() => {
        card1.classList.add('matched');
        card2.classList.add('matched');
        
        // Pass the dataset style to the message generator
        appendMessage(leftMessagesContainer, card1.dataset.name!, card1.dataset.message!, card1.dataset.style!);
        appendMessage(rightMessagesContainer, card2.dataset.name!, card2.dataset.message!, card2.dataset.style!);

        flippedCards = [];
        matchedPairs++;
        
        // If all possible pairs are matched (ignoring the odd one out if 9 cards)
        if (matchedPairs === totalPossiblePairs) {
          handleWin();
        }
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

function appendMessage(container: HTMLElement, name: string, messageText: string, styleClass: string) {
  const msgDiv = document.createElement('div');
  msgDiv.classList.add('revealed-message');
  
  // Use styleClass correctly here
  msgDiv.innerHTML = `<strong class="text-${styleClass}">${name}</strong> <p>${messageText}</p>`;
  
  container.appendChild(msgDiv);
  // Auto-scroll to bottom of the column
  container.scrollTop = container.scrollHeight;
}

// --- WIN LOGIC ---
async function handleWin() {
  clearInterval(timerInterval);
  finalTimeDisplay.innerText = `Your Time is ${Math.floor(seconds / 60)}:${(seconds % 60).toString().padStart(2, '0')} minutes`;
  showView(winView);

  // Save score including the card mode info
  await supabase.from('leaderboard').insert([{ 
    name: currentUser, 
    time_seconds: seconds, 
    card_info: currentCardModeText 
  }]);

  // Fetch leaderboard including card_info
  const { data } = await supabase.from('leaderboard')
    .select('name, time_seconds, card_info')
    .order('time_seconds', { ascending: true })
    .limit(5);
  
  leaderboardList.innerHTML = "";
  if (data) {
    data.forEach((entry) => {
      const li = document.createElement('li');
      const mins = Math.floor(entry.time_seconds / 60);
      const secs = (entry.time_seconds % 60).toString().padStart(2, '0');
      
      // Display format: Name - Time (Card Mode)
      const modeInfo = entry.card_info ? `(${entry.card_info})` : '';
      li.innerText = `${entry.name} - ${mins}:${secs} ${modeInfo}`;
      
      leaderboardList.appendChild(li);
    });
  }
}

init();