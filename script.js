import { initializeApp } from "https://www.gstatic.com/firebasejs/11.9.1/firebase-app.js";
import { getDatabase, ref, onValue, update } from "https://www.gstatic.com/firebasejs/11.9.1/firebase-database.js";
import { getAuth, signInAnonymously } from "https://www.gstatic.com/firebasejs/11.9.1/firebase-auth.js";


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
  // Сортируем сообщения по времени отправки, если они не отсортированы
  dialog.messages.sort((a, b) => new Date(a.date) - new Date(b.date));

  dialog.messages.forEach((msg, msgIndex) => {
    // В админ-панели мы можем упростить логику 'mine', поскольку редактируем все сообщения.
    // Но для визуальной согласованности оставим классы.
    const isMine = (msg.from_id === 'user_admin_panel'); // Условно считаем сообщения админа 'своими'

    const messageGroup = document.createElement('div');
    messageGroup.className = 'message-group';
    if (isMine) {
      messageGroup.classList.add('mine');
    }
    // Добавляем data-атрибуты для идентификации сообщения при редактировании
    messageGroup.dataset.dialogId = dialogId;
    messageGroup.dataset.msgIndex = msgIndex;

    const messageBubble = document.createElement('div');
    messageBubble.className = 'message-bubble';
    messageBubble.textContent = msg.text;
    // Устанавливаем цвет текста сообщения из базы данных
    messageBubble.style.color = msg.color || 'inherit';
    // Если сообщение собеседника, устанавливаем фон из базы данных или белый по умолчанию
    if (!isMine) {
      messageBubble.style.backgroundColor = msg.color || '#ffffff';
      // Если цвет текста светлый, для белого фона инвертируем цвет текста для читабельности
      if (isLightColor(msg.color || '#ffffff')) {
          messageBubble.style.color = '#000000';
      }
    }

    const messageTime = document.createElement('div');
    messageTime.className = 'message-time';
    const messageDate = new Date(msg.date);
    messageTime.textContent = `${messageDate.getHours().toString().padStart(2, '0')}:${messageDate.getMinutes().toString().padStart(2, '0')}`;

    messageGroup.appendChild(messageBubble);
    messageGroup.appendChild(messageTime);
    messagesAdminContainer.appendChild(messageGroup);

    // Добавляем обработчик контекстного меню при клике на пузырь сообщения
    messageBubble.addEventListener('click', (e) => {
        showEditMessageModal(dialogId, msgIndex, msg); // Показываем модальное окно редактирования
    });
  });

  // Вспомогательная функция для определения светлоты цвета (для текста на цветном фоне)
  function isLightColor(hex) {
      if (!hex || hex === 'inherit') return true;
      const r = parseInt(hex.slice(1, 3), 16);
      const g = parseInt(hex.slice(3, 5), 16);
      const b = parseInt(hex.slice(5, 7), 16);
      // HSP (Highly Sensitive Pooled) equation from http://alienryderflex.com/hsp.html
      const hsp = Math.sqrt(
          0.299 * (r * r) +
          0.587 * (g * g) +
          0.114 * (b * b)
      );
      return hsp > 127.5; // Считаем цвет светлым, если HSP > 127.5
  }
}

// ====== Глобальные переменные для модалки редактирования ======
let editModalMessage = null;
let editModalDialogId = null;
let editModalMsgIndex = null;

// ====== Показ модального окна редактирования сообщения ======
function showEditMessageModal(dialogId, msgIndex, message) {
  editModalDialogId = dialogId;
  editModalMsgIndex = msgIndex;
  editModalMessage = { ...message }; // Копируем сообщение, чтобы не менять напрямую данные в allDialogs

  const modalHtml = `
    <div class="admin-modal-content">
      <h3>Редактировать сообщение</h3>
      <p><strong>От:</strong> ${editModalMessage.from}</p>
      <textarea id="edit-message-text" rows="5">${editModalMessage.text}</textarea>
      <label>Цвет текста:</label>
      <div class="color-options">
        <button class="green" data-color="#4CAF50">Зеленый</button>
        <button class="red" data-color="#f44336">Красный</button>
        <button class="reset" data-color="#000000">Черный</button>
        <button class="reset" data-color="#FFFFFF">Белый</button>
        <button class="reset" data-color="#007aff">Синий</button>
      </div>
      <label for="edit-annotation-text">Пометка:</label>
      <textarea id="edit-annotation-text" rows="3">${editModalMessage.annotation || ''}</textarea>
      <div class="btn-group">
        <button class="btn btn-danger" onclick="closeAdminModal()">Отмена</button>
        <button class="btn" id="save-edited-message-btn">Сохранить</button>
      </div>
    </div>
  `;
  showAdminModal(modalHtml);

  // Заполняем текущие значения в модалке
  document.getElementById('edit-message-text').value = editModalMessage.text;
  document.getElementById('edit-annotation-text').value = editModalMessage.annotation;

  // Обработчики для кнопок цвета в модалке
  document.querySelectorAll('.admin-modal-content .color-options button').forEach(btn => {
    btn.onclick = (e) => {
      const color = e.target.dataset.color;
      editModalMessage.color = color; // Обновляем цвет в временной копии сообщения
      // Опционально: можно добавить предпросмотр цвета в модалке
    };
  });

  // Обработчик сохранения
  document.getElementById('save-edited-message-btn').onclick = () => {
    const updatedText = document.getElementById('edit-message-text').value;
    const updatedAnnotation = document.getElementById('edit-annotation-text').value;

    // Обновляем временную копию
    editModalMessage.text = updatedText;
    editModalMessage.annotation = updatedAnnotation;

    // Отправляем изменения в Firebase
    const updates = {};
    updates[`/dialogs/${editModalDialogId}/messages/${editModalMsgIndex}/text`] = updatedText;
    updates[`/dialogs/${editModalDialogId}/messages/${editModalMsgIndex}/color`] = editModalMessage.color;
    updates[`/dialogs/${editModalDialogId}/messages/${editModalMsgIndex}/annotation`] = updatedAnnotation;

    update(ref(db), updates)
      .then(() => {
        console.log("Сообщение успешно обновлено в Firebase!");
        closeAdminModal();
        // Перерендеринг сообщений, чтобы показать изменения
        renderMessagesForAdmin(editModalDialogId);
      })
      .catch(error => {
        console.error("Ошибка при обновлении сообщения:", error);
        alert("Ошибка при обновлении сообщения: " + error.message);
      });
  };
}

// ====== Функции для управления модальным окном админки ======
function showAdminModal(contentHtml) {
  const modal = document.createElement('div');
  modal.id = 'admin-overlay-modal'; // Уникальный ID для модалки админки
  modal.style.cssText = `
    position: fixed;
    top: 0; left: 0; right: 0; bottom: 0;
    background: rgba(0,0,0,0.4);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 2000; /* Выше основного модального окна */
  `;
  modal.innerHTML = contentHtml;
  document.body.appendChild(modal);

  modal.onclick = (e) => {
    if (e.target === modal) {
      closeAdminModal();
    }
  };
}

function closeAdminModal() {
  const modal = document.getElementById('admin-overlay-modal');
  if (modal) {
    modal.remove();
  }
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
