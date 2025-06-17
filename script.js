import { initializeApp } from "https://www.gstatic.com/firebasejs/11.9.1/firebase-app.js";
import { getDatabase, ref, onValue, update } from "https://www.gstatic.com/firebasejs/11.9.1/firebase-database.js";
import { getAuth, signInAnonymously } from "https://www.gstatic.com/firebasejs/11.9.1/firebase-auth.js";

// Ваша конфигурация Firebase (та же, что и для основного приложения)
const firebaseConfig = {
  apiKey: "AIzaSyDCD5MSC1-hFrXK2JD-rAkjbM4DmBTaYAo",
  authDomain: "koworking-5a698.firebaseapp.com",
  databaseURL: "https://koworking-5a698-default-rtdb.firebaseio.com",
  projectId: "koworking-5a698",
  storageBucket: "koworking-5a698.firebasestorage.app",
  messagingSenderId: "600778210650",
  appId: "1:600778210650:web:c7d3fa1a68ceae7ae4c763",
  measurementId: "G-KPY9KC2XNE"
};

// Инициализация Firebase
const app = initializeApp(firebaseConfig);
const db = getDatabase(app);
const auth = getAuth(app);

// ====== Глобальные переменные админки ======
let allDialogs = []; // Все диалоги из Firebase
let selectedDialogId = null; // ID текущего выбранного диалога

// ====== Элементы DOM ======
const dialogSelect = document.getElementById('dialog-select');
const messagesAdminContainer = document.getElementById('messages-admin-container');

// ====== Загрузка и рендер списка диалогов ======
function loadAndRenderDialogs() {
  signInAnonymously(auth)
    .then(() => {
      console.log("Админ-панель: Анонимный вход успешен.");
      const dialogsRef = ref(db, 'dialogs');
      onValue(dialogsRef, (snapshot) => {
        const data = snapshot.val();
        allDialogs = [];
        if (data) {
          for (let id in data) {
            allDialogs.push({ id: id, ...data[id] });
          }
        }
        populateDialogSelect();
      }, (error) => {
        console.error("Админ-панель: Ошибка при загрузке диалогов:", error);
        messagesAdminContainer.innerHTML = '<p style="color:red;">Ошибка загрузки диалогов. Проверьте консоль.</p>';
      });
    })
    .catch((error) => {
      console.error("Админ-панель: Ошибка анонимного входа:", error);
      messagesAdminContainer.innerHTML = '<p style="color:red;">Не удалось войти в Firebase. Проверьте подключение.</p>';
    });
}

function populateDialogSelect() {
  dialogSelect.innerHTML = '<option value="">Выберите диалог</option>';
  allDialogs.forEach(dialog => {
    const option = document.createElement('option');
    option.value = dialog.id;
    // Отображаем название диалога и имя создателя (если есть)
    option.textContent = `${dialog.title || 'Без названия'} (${dialog.creatorUsername || 'Веб-пользователь'})`;
    dialogSelect.appendChild(option);
  });
  // Если был выбран диалог ранее, пытаемся его снова выбрать
  if (selectedDialogId) {
    dialogSelect.value = selectedDialogId;
    renderMessagesForAdmin(selectedDialogId);
  }
}

// ====== Рендер сообщений для админки ======
function renderMessagesForAdmin(dialogId) {
  const dialog = allDialogs.find(d => d.id === dialogId);
  if (!dialog || !dialog.messages || dialog.messages.length === 0) {
    messagesAdminContainer.innerHTML = '<p>Сообщений в этом диалоге нет.</p>';
    return;
  }

  messagesAdminContainer.innerHTML = '';
  dialog.messages.forEach((msg, msgIndex) => {
    const messageItem = document.createElement('div');
    messageItem.className = 'message-item';
    messageItem.innerHTML = `
      <div class="meta">От: ${msg.from} (${new Date(msg.date).toLocaleString()})</div>
      <div class="text" style="color: ${msg.color || 'inherit'};">${msg.text}</div>
      <div class="color-buttons">
        <button class="green" data-color="#4CAF50">Зеленый</button>
        <button class="red" data-color="#f44336">Красный</button>
        <button class="reset" data-color="#ffffff">Сброс</button>
      </div>
      <label for="annotation-${dialogId}-${msgIndex}">Пометка:</label>
      <textarea id="annotation-${dialogId}-${msgIndex}" rows="3" placeholder="Как стоило лучше...">${msg.annotation || ''}</textarea>
      <button class="save-btn" data-dialog-id="${dialogId}" data-msg-index="${msgIndex}">Сохранить</button>
    `;
    messagesAdminContainer.appendChild(messageItem);
  });

  // Добавляем обработчики событий для кнопок цвета и сохранения
  messagesAdminContainer.querySelectorAll('.color-buttons button').forEach(btn => {
    btn.onclick = (e) => {
      const color = e.target.dataset.color;
      const messageTextDiv = e.target.closest('.message-item').querySelector('.text');
      messageTextDiv.style.color = color;
      // Временно сохраняем выбранный цвет, чтобы при сохранении он был правильным
      messageTextDiv.dataset.currentColor = color;
    };
  });

  messagesAdminContainer.querySelectorAll('.save-btn').forEach(btn => {
    btn.onclick = (e) => {
      const dId = e.target.dataset.dialogId;
      const mIndex = parseInt(e.target.dataset.msgIndex);
      const currentMessage = dialog.messages[mIndex];

      const newAnnotation = document.getElementById(`annotation-${dId}-${mIndex}`).value;
      // Получаем цвет из dataset, установленного при клике на кнопки цвета
      const newColor = e.target.closest('.message-item').querySelector('.text').dataset.currentColor || currentMessage.color;

      // Обновляем сообщение в локальном объекте (пока не в Firebase)
      currentMessage.annotation = newAnnotation;
      currentMessage.color = newColor;

      // Сохраняем все сообщения обратно в Firebase для данного диалога
      const updates = {};
      updates[`/dialogs/${dId}/messages/${mIndex}/annotation`] = newAnnotation;
      updates[`/dialogs/${dId}/messages/${mIndex}/color`] = newColor;

      update(ref(db), updates)
        .then(() => {
          console.log("Сообщение обновлено успешно!");
          // Возможно, стоит перерендерить только это сообщение или дать визуальную обратную связь
          // Пока просто выведем сообщение
          alert("Изменения сохранены!");
        })
        .catch(error => {
          console.error("Ошибка при сохранении сообщения:", error);
          alert("Ошибка при сохранении изменений: " + error.message);
        });
    };
  });
}

// ====== Обработчики событий ======
dialogSelect.onchange = (e) => {
  selectedDialogId = e.target.value;
  if (selectedDialogId) {
    renderMessagesForAdmin(selectedDialogId);
  } else {
    messagesAdminContainer.innerHTML = '<p>Выберите диалог, чтобы просмотреть сообщения.</p>';
  }
};

// ====== Инициализация админ-панели ======
window.onload = loadAndRenderDialogs; 
