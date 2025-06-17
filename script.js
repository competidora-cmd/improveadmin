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
let selectedAdminViewParticipantId = null; // ID участника, чьи сообщения отображаются справа в админ-панели

// ====== Элементы DOM ======
const dialogSelect = document.getElementById('dialog-select');
const messagesAdminContainer = document.getElementById('admin-messages-list'); // Изменено на новый ID
const adminViewParticipantSelect = document.getElementById('admin-view-participant-select');

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
  adminViewParticipantSelect.innerHTML = '<option value="">Выберите участника</option>'; // Очищаем список участников

  allDialogs.forEach(dialog => {
    const option = document.createElement('option');
    option.value = dialog.id;
    option.textContent = `${dialog.title || 'Без названия'} (${dialog.creatorUsername || 'Веб-пользователь'})`;
    dialogSelect.appendChild(option);
  });

  if (selectedDialogId) {
    dialogSelect.value = selectedDialogId;
    populateParticipantSelect(selectedDialogId); // Заполняем участников для выбранного диалога
  }
}

// ====== Заполнение списка участников ======
function populateParticipantSelect(dialogId) {
  adminViewParticipantSelect.innerHTML = '<option value="">Выберите участника</option>';
  const dialog = allDialogs.find(d => d.id === dialogId);
  if (dialog && dialog.participants) {
    for (const pId in dialog.participants) {
      const option = document.createElement('option');
      option.value = pId; // ID участника
      option.textContent = dialog.participants[pId]; // Имя участника
      adminViewParticipantSelect.appendChild(option);
    }
    // Если выбран участник ранее, пытаемся его снова выбрать
    if (selectedAdminViewParticipantId && dialog.participants[selectedAdminViewParticipantId]) {
      adminViewParticipantSelect.value = selectedAdminViewParticipantId;
      renderMessagesForAdmin(dialogId, selectedAdminViewParticipantId);
    } else if (Object.keys(dialog.participants).length > 0) {
        // Если нет ранее выбранного, но есть участники, выбираем первого по умолчанию
        selectedAdminViewParticipantId = Object.keys(dialog.participants)[0];
        adminViewParticipantSelect.value = selectedAdminViewParticipantId;
        renderMessagesForAdmin(dialogId, selectedAdminViewParticipantId);
    } else {
        messagesAdminContainer.innerHTML = '<p>У этого диалога нет участников.</p>';
        selectedAdminViewParticipantId = null;
    }
  }
}

// ====== Рендер сообщений для админки ======
function renderMessagesForAdmin(dialogId, alignRightById = null) {
  const dialog = allDialogs.find(d => d.id === dialogId);
  if (!dialog || !dialog.messages || dialog.messages.length === 0) {
    messagesAdminContainer.innerHTML = '<p>Сообщений в этом диалоге нет.</p>';
    return;
  }

  messagesAdminContainer.innerHTML = '';
  dialog.messages.sort((a, b) => new Date(a.date) - new Date(b.date));

  dialog.messages.forEach((msg, msgIndex) => {
    // isRightAligned теперь зависит от выбранного участника в админ-панели
    const isRightAligned = (alignRightById && msg.from_id === alignRightById);

    const messageGroup = document.createElement('div');
    messageGroup.className = 'message-group';
    if (isRightAligned) {
      messageGroup.classList.add('mine'); // Используем класс 'mine' для выравнивания вправо и синего фона
    }
    messageGroup.dataset.dialogId = dialogId;
    messageGroup.dataset.msgIndex = msgIndex;

    const messageBubble = document.createElement('div');
    messageBubble.className = 'message-bubble';

    // Добавляем имя отправителя внутри пузыря сообщения
    const senderName = document.createElement('div');
    senderName.className = 'message-sender';
    senderName.textContent = msg.from; // Имя отправителя
    messageBubble.appendChild(senderName);

    // Добавляем текст сообщения
    const messageText = document.createElement('div');
    messageText.className = 'message-text-content'; // Добавил новый класс для текста
    messageText.textContent = msg.text;
    messageBubble.appendChild(messageText);

    // Применяем цвет фона пузыря сообщения
    if (isRightAligned) {
      // Для 'своих' сообщений (справа) фон синий из CSS .message-group.mine .message-bubble
      // Цвет текста будет белым из CSS
    } else {
      // Для 'чужих' сообщений (слева) фон берем из msg.color или белый по умолчанию
      messageBubble.style.backgroundColor = msg.color || '#ffffff';
      // Регулируем цвет текста для контраста
      if (isLightColor(messageBubble.style.backgroundColor)) {
        messageBubble.style.color = '#000000'; // Черный текст на светлом фоне
      } else {
        messageBubble.style.color = '#ffffff'; // Белый текст на темном фоне
      }
      senderName.style.color = isLightColor(messageBubble.style.backgroundColor) ? '#888' : '#ccc'; // Цвет имени отправителя для чужих сообщений
    }

    const messageTime = document.createElement('div');
    messageTime.className = 'message-time';
    const messageDate = new Date(msg.date);
    messageTime.textContent = `${messageDate.getHours().toString().padStart(2, '0')}:${messageDate.getMinutes().toString().padStart(2, '0')}`;

    messageGroup.appendChild(messageBubble);
    messageGroup.appendChild(messageTime);
    messagesAdminContainer.appendChild(messageGroup);

    messageBubble.addEventListener('click', (e) => {
        e.stopPropagation();
        showEditMessageModal(dialogId, msgIndex, msg, e);
    });
  });

  function isLightColor(hex) {
      if (!hex || hex === 'inherit') return true;
      const cleanHex = hex.startsWith('#') ? hex.slice(1) : hex;

      if (cleanHex.length !== 6 && cleanHex.length !== 3) {
          console.warn("Некорректный формат HEX цвета: ", hex);
          return true;
      }
      
      let r, g, b;
      if (cleanHex.length === 3) {
          r = parseInt(cleanHex[0] + cleanHex[0], 16);
          g = parseInt(cleanHex[1] + cleanHex[1], 16);
          b = parseInt(cleanHex[2] + cleanHex[2], 16);
      } else {
          r = parseInt(cleanHex.slice(0, 2), 16);
          g = parseInt(cleanHex.slice(2, 4), 16);
          b = parseInt(cleanHex.slice(4, 6), 16);
      }

      const hsp = Math.sqrt(
          0.299 * (r * r) +
          0.587 * (g * g) +
          0.114 * (b * b)
      );
      return hsp > 127.5;
  }
}

// ====== Глобальные переменные для модалки редактирования ======
let editModalMessage = null;
let editModalDialogId = null;
let editModalMsgIndex = null;

// ====== Показ модального окна редактирования сообщения ======
function showEditMessageModal(dialogId, msgIndex, message, e) {
  editModalDialogId = dialogId;
  editModalMsgIndex = msgIndex;
  editModalMessage = { ...message }; // Копируем сообщение, чтобы не менять напрямую данные в allDialogs

  // Получаем позицию кликнутого элемента
  const rect = e.target.getBoundingClientRect();
  const viewportWidth = window.innerWidth || document.documentElement.clientWidth;
  const viewportHeight = window.innerHeight || document.documentElement.clientHeight;

  // Определение оптимальных координат для модального окна
  let modalX = rect.right + 20; // По умолчанию справа от сообщения
  let modalY = rect.top;

  // Если модалка выходит за правую границу, перемещаем ее налево
  const predictedModalWidth = 500; // Примерная максимальная ширина модалки
  if (modalX + predictedModalWidth > viewportWidth - 20) {
    modalX = rect.left - predictedModalWidth - 20; // Слева от сообщения
    if (modalX < 20) { // Если и слева не помещается, центрируем
        modalX = (viewportWidth - predictedModalWidth) / 2;
    }
  }

  // Если модалка выходит за нижнюю границу, сдвигаем вверх
  const predictedModalHeight = 350; // Примерная высота модалки
  if (modalY + predictedModalHeight > viewportHeight - 20) {
    modalY = viewportHeight - predictedModalHeight - 20; // Сдвигаем вверх
    if (modalY < 20) { // Если слишком высоко, ставим в начало
        modalY = 20;
    }
  }
  
  // Убедимся, что координаты не отрицательные
  modalX = Math.max(20, modalX);
  modalY = Math.max(20, modalY);

  const modalHtml = `
    <div class="admin-modal-content">
      <h3>Редактировать сообщение</h3>
      <p><strong>От:</strong> ${editModalMessage.from}</p>
      <textarea id="edit-message-text" rows="5">${editModalMessage.text}</textarea>
      <label>Цвет текста сообщения:</label>
      <div class="color-options">
        <button class="green" data-color="#4CAF50">Зеленый</button>
        <button class="red" data-color="#f44336">Красный</button>
        <button class="reset" data-color="#000000">Черный</button>
        <button class="reset" data-color="#FFFFFF">Белый</button>
        <button class="reset" data-color="inherit">По умолчанию</button>
      </div>
      <label for="edit-annotation-text">Пометка:</label>
      <textarea id="edit-annotation-text" rows="3">${editModalMessage.annotation || ''}</textarea>
      <div class="btn-group">
        <button class="btn btn-danger" id="cancel-admin-modal-btn">Отмена</button>
        <button class="btn" id="save-edited-message-btn">Сохранить</button>
      </div>
    </div>
  `;
  showAdminModal(modalHtml, modalX, modalY);

  // Заполняем текущие значения в модалке
  document.getElementById('edit-message-text').value = editModalMessage.text;
  document.getElementById('edit-annotation-text').value = editModalMessage.annotation;

  // Обработчики для кнопок цвета в модалке
  document.querySelectorAll('.admin-modal-content .color-options button').forEach(btn => {
    btn.onclick = (e) => {
      const color = e.target.dataset.color;
      editModalMessage.color = color; // Обновляем цвет в временной копии сообщения
      // TODO: Можно добавить предпросмотр цвета в модалке, если нужно
    };
  });

  // Обработчик сохранения
  document.getElementById('save-edited-message-btn').onclick = () => {
    const updatedText = document.getElementById('edit-message-text').value;
    const updatedAnnotation = document.getElementById('edit-annotation-text').value;

    editModalMessage.text = updatedText;
    editModalMessage.annotation = updatedAnnotation;

    const updates = {};
    updates[`/dialogs/${editModalDialogId}/messages/${editModalMsgIndex}/text`] = updatedText;
    updates[`/dialogs/${editModalDialogId}/messages/${editModalMsgIndex}/color`] = editModalMessage.color;
    updates[`/dialogs/${editModalDialogId}/messages/${editModalMsgIndex}/annotation`] = updatedAnnotation;

    update(ref(db), updates)
      .then(() => {
        console.log("Сообщение успешно обновлено в Firebase!");
        closeAdminModal();
        // Перерендеринг сообщений с учетом нового выбора участника
        renderMessagesForAdmin(editModalDialogId, selectedAdminViewParticipantId);
      })
      .catch(error => {
        console.error("Ошибка при обновлении сообщения:", error);
        alert("Ошибка при обновлении сообщения: " + error.message);
      });
  };

  // Обработчик кнопки Отмена
  document.getElementById('cancel-admin-modal-btn').onclick = () => {
    closeAdminModal();
  };
}

// ====== Функции для управления модальным окном админки ======
function showAdminModal(contentHtml, x = null, y = null) {
  let modal = document.getElementById('admin-overlay-modal');
  if (!modal) {
      modal = document.createElement('div');
      modal.id = 'admin-overlay-modal';
      modal.style.cssText = `
        position: fixed;
        top: 0; left: 0; right: 0; bottom: 0;
        background: rgba(0,0,0,0.4);
        z-index: 2000;
      `;
      document.body.appendChild(modal);
  }
  modal.innerHTML = contentHtml;
  modal.style.display = 'block'; // Показываем модалку

  // Позиционируем содержимое модального окна
  const modalContent = modal.querySelector('.admin-modal-content');
  if (modalContent && x !== null && y !== null) {
      modalContent.style.position = 'absolute';
      modalContent.style.left = `${x}px`;
      modalContent.style.top = `${y}px`;
      modalContent.style.transform = 'none'; // Отключаем центрирование
  } else if (modalContent) {
      // Если координаты не переданы, центрируем по умолчанию
      modalContent.style.position = 'absolute';
      modalContent.style.left = '50%';
      modalContent.style.top = '50%';
      modalContent.style.transform = 'translate(-50%, -50%)';
  }

  modal.onclick = (e) => {
    // Закрываем модалку только если клик был по самому оверлею, а не по контенту модалки
    if (e.target === modal) {
      closeAdminModal();
    }
  };
}

function closeAdminModal() {
  const modal = document.getElementById('admin-overlay-modal');
  if (modal) {
    modal.style.display = 'none'; // Скрываем модалку
    modal.innerHTML = ''; // Очищаем содержимое
  }
}

// ====== Обработчики событий ======
dialogSelect.onchange = (e) => {
  selectedDialogId = e.target.value;
  if (selectedDialogId) {
    populateParticipantSelect(selectedDialogId); // Заполняем и выбираем участника
  } else {
    messagesAdminContainer.innerHTML = '<p>Выберите диалог, чтобы просмотреть сообщения.</p>';
    adminViewParticipantSelect.innerHTML = '<option value="">Выберите участника</option>'; // Очищаем
    selectedAdminViewParticipantId = null;
  }
};

adminViewParticipantSelect.onchange = (e) => {
  selectedAdminViewParticipantId = e.target.value;
  if (selectedDialogId && selectedAdminViewParticipantId) {
    renderMessagesForAdmin(selectedDialogId, selectedAdminViewParticipantId);
  } else {
    messagesAdminContainer.innerHTML = '<p>Выберите участника, чтобы просмотреть сообщения.</p>';
  }
};

// ====== Инициализация админ-панели ======
window.onload = loadAndRenderDialogs; 
