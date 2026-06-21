const firebaseConfig = {
  apiKey: "AIzaSyAYEJAdYUOKTX34-e6E69pbtH94uYHVFnA",
  authDomain: "my-memo-app-bc3c5.firebaseapp.com",
  projectId: "my-memo-app-bc3c5",
  storageBucket: "my-memo-app-bc3c5.firebasestorage.app",
  messagingSenderId: "882940407651",
  appId: "1:882940407651:web:5160b3faee7930334fad56"
};

const GEMINI_API_KEY = "AQ.Ab8RN6LUXnz9jpC2TZIckXBwN1UduKJz_UqVMWXVg753B6iW5w"; 

let currentMemoId = null; 

firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();

const mainPage = document.getElementById('main-page');
const loginPage = document.getElementById('login-page');
const memoPage = document.getElementById('memo-page');

const goToLoginBtn = document.getElementById('go-to-login-btn');
const googleLoginBtn = document.getElementById('google-login-btn');
const backToMainBtn = document.getElementById('back-to-main-btn');
const logoutBtn = document.getElementById('logout-btn');

const addFolderBtn = document.querySelector('.add-folder-btn');
const folderListUI = document.getElementById('folder-list');

let currentUserId = null;
let currentFolderId = null;
let userFoldersMap = {}; 
let isSelectMode = false; 

let currentCenterView = 'editor'; 
let activeFolderId = null; 

function changePage(activePage) {
  mainPage.classList.remove('active');
  loginPage.classList.remove('active');
  memoPage.classList.remove('active');
  activePage.classList.add('active');
}

if (goToLoginBtn) goToLoginBtn.addEventListener('click', () => changePage(loginPage));
if (backToMainBtn) backToMainBtn.addEventListener('click', () => changePage(mainPage));

if (googleLoginBtn) {
  googleLoginBtn.addEventListener('click', () => {
    const provider = new firebase.auth.GoogleAuthProvider();
    auth.signInWithPopup(provider).catch((error) => alert("로그인 오류: " + error.message));
  });
}

if (logoutBtn) {
  logoutBtn.addEventListener('click', () => {
    if (confirm('로그아웃 하시겠습니까?')) {
      auth.signOut();
    }
  });
}

auth.onAuthStateChanged((user) => {
  if (user) {
    currentUserId = user.uid;
    const userNameEl = document.getElementById('user-name');
    if (userNameEl) userNameEl.innerText = `${user.displayName}님`;
    changePage(memoPage);
    syncFoldersAndMemos(user.uid); 
  } else {
    currentUserId = null;
    currentFolderId = null;
    userFoldersMap = {};
    changePage(mainPage);
  }
});

function syncFoldersAndMemos(userId) {
  db.collection('users').doc(userId).collection('folders')
    .onSnapshot((folderSnapshot) => {
      if (!folderListUI) return;
      folderListUI.innerHTML = ''; 
      userFoldersMap = {}; 

      if (folderSnapshot.empty) {
        db.collection('users').doc(userId).collection('folders').add({
          name: "일반 메모"
        });
        return;
      }

      folderSnapshot.forEach((folderDoc) => {
        const folderId = folderDoc.id;
        const folderData = folderDoc.data();
        
        const cleanName = folderData.name.replace(/📁\s*/, '').trim();
        userFoldersMap[cleanName] = folderId;

        const folderContainer = document.createElement('li');
        folderContainer.className = 'folder-container';
        folderContainer.setAttribute('id', `container-${folderId}`);

        const folderItem = document.createElement('div');
        folderItem.className = 'folder-item';
        folderItem.innerText = folderData.name.startsWith('📁') ? folderData.name : `📁 ${folderData.name}`;
        
        const nestedMemoList = document.createElement('ul');
        nestedMemoList.className = 'nested-memo-list';
        nestedMemoList.setAttribute('id', `memos-of-${folderId}`);

        if (currentFolderId === folderId) {
          folderContainer.classList.add('open');
          folderItem.classList.add('active');
        }

        folderItem.addEventListener('click', () => {
          const isOpen = folderContainer.classList.contains('open');
          document.querySelectorAll('.nested-memo-list li').forEach(li => li.classList.remove('active-file'));

          if (isOpen) {
            folderContainer.classList.remove('open');
            folderItem.classList.remove('active');
            nestedMemoList.innerHTML = ''; 
          } else {
            document.querySelectorAll('.folder-item').forEach(item => item.classList.remove('active'));
            document.querySelectorAll('.folder-container').forEach(c => {
              c.classList.remove('open');
              const memoListUl = c.querySelector('.nested-memo-list');
              if (memoListUl) memoListUl.innerHTML = '';
            });

            folderItem.classList.add('active');
            folderContainer.classList.add('open');
            currentFolderId = folderId; 
            activeFolderId = folderId; 
            
            fetchMemosForFolder(folderId, nestedMemoList);
            
            const folderTitleEl = document.getElementById('current-folder-title');
            if (folderTitleEl) folderTitleEl.innerText = cleanName;
            renderDashboardFiles(folderId);
            switchCenterView('dashboard');
          }
        });

        folderContainer.appendChild(folderItem);
        folderContainer.appendChild(nestedMemoList);
        folderListUI.appendChild(folderContainer);

        if (currentFolderId === folderId) {
          fetchMemosForFolder(folderId, nestedMemoList);
        }
      });
    });
}

function fetchMemosForFolder(folderId, targetUI) {
  db.collection('users').doc(currentUserId).collection('memos')
    .where('folderId', '==', folderId)
    .orderBy('createdAt', 'desc')
    .onSnapshot((memoSnapshot) => {
      targetUI.innerHTML = ''; 

      if (memoSnapshot.empty) {
        targetUI.innerHTML = '<li>(메모 없음)</li>';
        return;
      }

      memoSnapshot.forEach((memoDoc) => {
        const memoId = memoDoc.id;
        const memoData = memoDoc.data();

        const memoLi = document.createElement('li');
        memoLi.className = 'memo-tree-item';
        memoLi.setAttribute('data-memo-id', memoId); 

        if (isSelectMode) {
          memoLi.classList.add('select-mode-active');
        }

        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.className = 'memo-checkbox';
        checkbox.addEventListener('click', (e) => {
          e.stopPropagation(); 
        });

        const titleSpan = document.createElement('span');
        titleSpan.innerText = memoData.title.trim() ? `📄 ${memoData.title}` : "📄 제목 없는 메모";

        memoLi.addEventListener('click', (e) => {
          e.stopPropagation(); 
          openMemoInEditor(memoId, memoData, memoLi);
        });

        memoLi.appendChild(checkbox);
        memoLi.appendChild(titleSpan);
        targetUI.appendChild(memoLi);
      });
    }, (error) => {
      console.error("트리 메모 동기화 실패:", error);
    });
}

function openMemoInEditor(memoId, memoData, targetLiEl = null) {
  document.querySelectorAll('.nested-memo-list li').forEach(li => li.classList.remove('active-file'));
  if (targetLiEl) {
    targetLiEl.classList.add('active-file');
  } else {
    const activeTreeItem = document.querySelector(`.memo-tree-item[data-memo-id="${memoId}"]`);
    if (activeTreeItem) activeTreeItem.classList.add('active-file');
  }

  document.getElementById('memo-title').value = memoData.title;
  document.getElementById('memo-content').value = memoData.content;
  
  const saveBtn = document.getElementById('save-btn');
  if (saveBtn) saveBtn.setAttribute('data-current-memo-id', memoId);
  
  currentMemoId = memoId; 
  updateCharCount(); 
  switchCenterView('editor');
}
let dashboardListener = null;


function renderDashboardFiles(folderId) {
  const dashboardFileList = document.getElementById('dashboard-file-list');
  if (!dashboardFileList) return;

  // get() 대신 onSnapshot을 사용하여 파이어베이스의 변경사항을 실시간으로 화면에 반영합니다.
  if (dashboardListener) {
    dashboardListener(); 
  }

  // 새로운 폴더에 대한 리스너를 시작하고, 그 종료 스위치를 dashboardListener에 저장
  dashboardListener = db.collection('users').doc(currentUserId).collection('memos')
    .where('folderId', '==', folderId)
    .orderBy('createdAt', 'desc')
    .onSnapshot((snapshot) => {
      dashboardFileList.innerHTML = '';
      
      if (snapshot.empty) {
        dashboardFileList.innerHTML = '<div class="future-feature-placeholder">이 폴더에 저장된 메모가 없습니다.</div>';
        return;
      }

      snapshot.forEach((doc) => {
        const memoId = doc.id;
        const memoData = doc.data();

        const fileCard = document.createElement('div');
        fileCard.className = 'file-card';
        
        const cardTitle = document.createElement('h3');
        cardTitle.innerText = memoData.title.trim() ? memoData.title : "제목 없는 메모";
        
        const cardDesc = document.createElement('p');
        cardDesc.innerText = memoData.content.trim() ? memoData.content : "(내용 없음)";

        fileCard.addEventListener('click', () => {
          openMemoInEditor(memoId, memoData);
        });

        fileCard.appendChild(cardTitle);
        fileCard.appendChild(cardDesc);
        dashboardFileList.appendChild(fileCard);
      });
    }, (err) => {
      console.error("대시보드 실시간 로드 에러:", err);
    });
}

if (addFolderBtn) {
  addFolderBtn.addEventListener('click', () => {
    if (!currentUserId) return;
    const folderName = prompt('새로 만들 폴더의 이름을 입력하세요:');
    if (!folderName || !folderName.trim()) return;

    document.querySelectorAll('.nested-memo-list li').forEach(li => li.classList.remove('active-file'));

    db.collection('users').doc(currentUserId).collection('folders').add({
      name: folderName.trim()
    });
  });
}

const saveBtnEl = document.getElementById('save-btn');
// --- [4] 기존 저장 버튼 기능 변경 (이제 저장 버튼은 '작성 완료 후 대시보드로 나가기' 역할) ---
if (saveBtnEl) {
  saveBtnEl.onclick = function() {
    if (!currentUserId) return;

    let title = document.getElementById('memo-title').value;
    const content = document.getElementById('memo-content').value;

    // 만약 완전히 비어있다면 가이드 제공
    if (!title.trim() && !content.trim()) {
      if (confirm("내용이 없는 빈 메모입니다. 이대로 리스트에 남겨두시겠습니까?")) {
        clearMemoEditor();
        if (currentFolderId) renderDashboardFiles(currentFolderId);
        switchCenterView('dashboard');
      }
      return;
    }

    // 최종 정돈 후 대시보드로 탈출
    autoSaveMemo(); 
    clearMemoEditor();
    if (currentFolderId) renderDashboardFiles(currentFolderId);
    switchCenterView('dashboard');
  };
}

function clearMemoEditor() {
  document.getElementById('memo-title').value = '';
  document.getElementById('memo-content').value = '';
  currentMemoId = null;
  const saveBtn = document.getElementById('save-btn');
  if (saveBtn) saveBtn.removeAttribute('data-current-memo-id');
  
  document.querySelectorAll('.nested-memo-list li').forEach(li => li.classList.remove('active-file'));

  if (isSelectMode && selectModeBtn) {
    selectModeBtn.click();
  }
}

function refreshMemoList() {
  const activeTargetUI = document.getElementById(`memos-of-${currentFolderId}`);
  if (activeTargetUI) fetchMemosForFolder(currentFolderId, activeTargetUI);
}

const memoContentInput = document.getElementById('memo-content');
const charCountSpan = document.getElementById('char-count');

if (memoContentInput) {
  memoContentInput.addEventListener('input', () => {
    updateCharCount();
  });
}

function updateCharCount() {
  if (charCountSpan && memoContentInput) {
    const textLength = memoContentInput.value.length;
    charCountSpan.innerText = textLength;
  }
}

setInterval(() => {
  if (document.activeElement !== memoContentInput) {
    updateCharCount();
  }
}, 300);

const folderListGlobal = document.getElementById('folder-list');
if (folderListGlobal) {
  folderListGlobal.addEventListener('click', (e) => {
    if (e.target && e.target.tagName === 'LI' && e.target.innerText.includes('📄')) {
      setTimeout(() => {
        const saveBtn = document.getElementById('save-btn');
        const targetMemoId = saveBtn ? saveBtn.getAttribute('data-current-memo-id') : null;
        if (targetMemoId) {
          currentMemoId = targetMemoId;
          console.log("현재 선택된 메모 ID 추적 중:", currentMemoId);
        }
      }, 100);
    }
  });
}

const deleteBtnEl = document.getElementById('delete-btn');
if (deleteBtnEl) {
  deleteBtnEl.onclick = function() {
    if (!currentUserId) return;

    const checkedBoxes = document.querySelectorAll('.memo-checkbox:checked');
    if (checkedBoxes.length > 0) {
      if (confirm(`정말로 선택한 ${checkedBoxes.length}개의 메모를 일괄 삭제하시겠습니까?`)) {
        const batch = db.batch();
        checkedBoxes.forEach((box) => {
          const memoLi = box.closest('.memo-tree-item');
          if (memoLi) {
            const memoId = memoLi.getAttribute('data-memo-id');
            const memoRef = db.collection('users').doc(currentUserId).collection('memos').doc(memoId);
            batch.delete(memoRef);
          }
        });

        batch.commit()
        .then(() => {
          alert('선택한 메모들이 삭제되었습니다.');
          clearMemoEditor();
          if (currentFolderId) renderDashboardFiles(currentFolderId);
          switchCenterView('dashboard');
        })
        .catch((error) => alert("일괄 삭제 실패: " + error.message));
      }
      return; 
    }

    const targetMemoId = currentMemoId || (document.getElementById('save-btn') ? document.getElementById('save-btn').getAttribute('data-current-memo-id') : null);
    if (targetMemoId) {
      if (confirm('정말로 현재 열려있는 이 메모를 삭제하시겠습니까?')) {
        db.collection('users').doc(currentUserId).collection('memos').doc(targetMemoId).delete()
        .then(() => {
          alert('메모가 삭제되었습니다.');
          clearMemoEditor();
          if (currentFolderId) renderDashboardFiles(currentFolderId);
          switchCenterView('dashboard');
        })
        .catch((error) => alert("메모 삭제 실패: " + error.message));
      }
      return; 
    }

    if (currentFolderId) {
      const folderName = Object.keys(userFoldersMap).find(key => userFoldersMap[key] === currentFolderId) || "현재";
      
      if (confirm(`[경고!!!] 정말로 '${folderName}' 폴더를 삭제하시겠습니까?\n폴더 내부의 모든 메모도 함께 영구 삭제됩니다.`)) {
        db.collection('users').doc(currentUserId).collection('memos')
          .where('folderId', '==', currentFolderId)
          .get()
          .then((memoSnapshot) => {
            const batch = db.batch();
            memoSnapshot.forEach((doc) => {
              batch.delete(doc.ref);
            });
            const folderRef = db.collection('users').doc(currentUserId).collection('folders').doc(currentFolderId);
            batch.delete(folderRef);
            return batch.commit();
          })
          .then(() => {
            alert(`'${folderName}' 폴더와 그 안의 메모들이 모두 삭제되었습니다.`);
            currentFolderId = null;
            activeFolderId = null;
            clearMemoEditor();
            switchCenterView('editor');
          })
          .catch((error) => alert("폴더 일괄 삭제 실패: " + error.message));
      }
      return;
    }

    alert('삭제할 파일이나 폴더가 선택되지 않았습니다.\n목록에서 파일이나 폴더를 먼저 선택해 주세요!');
  };
}

// --- 새 메모 버튼 클릭 시: 폴더가 선택되어 있지 않으면 경고 팝업만 띄움 ---
const newMemoBtn = document.getElementById('new-memo-btn');
if (newMemoBtn) {
  newMemoBtn.addEventListener('click', () => {
    if (!currentUserId) return;

    // 1. 현재 선택된 폴더가 있는지 확인 (기존에 클릭해서 활성화된 폴더 ID)
    let targetFolderId = currentFolderId || activeFolderId;

    // 2. 선택된 폴더가 없다면 메모를 생성하지 않고 알림창만 띄운 뒤 종료
    if (!targetFolderId) {
      alert("새 메모를 작성할 폴더를 선택해주세요.");
      return;
    }

    // 3. 폴더가 정상적으로 선택되어 있다면 그 폴더 안에 빈 메모 선 생성
    db.collection('users').doc(currentUserId).collection('memos').add({
      folderId: targetFolderId,
      title: "",      
      content: "",    
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    })
    .then((docRef) => {
      console.log("선택된 폴더에 빈 메모 선 생성 성공, ID:", docRef.id);
      
      // 에디터 폼 초기화
      document.getElementById('memo-title').value = '';
      document.getElementById('memo-content').value = '';
      
      // 현재 에디터가 추적할 메모 ID 설정
      currentMemoId = docRef.id;
      const saveBtn = document.getElementById('save-btn');
      if (saveBtn) saveBtn.setAttribute('data-current-memo-id', docRef.id);

      // 에디터 화면으로 전환 및 글자수 갱신
      switchCenterView('editor');
      updateCharCount();
    })
    .catch((error) => {
      console.error("새 메모 생성 실패:", error);
    });
  });
}

// --- [2] 자동 저장 로직 (입력할 때마다 실시간으로 파이어베이스에 반영) ---
function autoSaveMemo() {
  if (!currentUserId || !currentMemoId) return;

  const title = document.getElementById('memo-title').value;
  const content = document.getElementById('memo-content').value;

  // 빈 문서라도 유저가 나갔을 때 날아가지 않도록 현재 텍스트 상태를 그대로 업데이트
  db.collection('users').doc(currentUserId).collection('memos').doc(currentMemoId).update({
    title: title,
    content: content,
    updatedAt: firebase.firestore.FieldValue.serverTimestamp()
  })
  .then(() => {
    console.log("실시간 자동 저장 완료");
  })
  .catch((error) => {
    console.error("자동 저장 중 오류 발생:", error);
  });
}

const memoTitleInput = document.getElementById('memo-title');
if (memoTitleInput) {
  // 제목을 입력할 때마다 자동 저장
  memoTitleInput.addEventListener('input', autoSaveMemo);
}

if (memoContentInput) {
  // 본문을 입력할 때마다 자동 저장 및 글자수 갱신
  memoContentInput.addEventListener('input', () => {
    autoSaveMemo();
    updateCharCount();
  });
}

const aiSummaryBtn = document.getElementById('ai-summary-btn');
const aiSummaryResultBox = document.getElementById('ai-summary-result-box');
const aiSummaryText = document.getElementById('ai-summary-text');
const aiSummarySaveBtn = document.getElementById('ai-summary-save-btn');

let latestSummaryContent = ""; 

if (aiSummaryBtn) {
  aiSummaryBtn.addEventListener('click', async () => {
    const content = document.getElementById('memo-content').value;

    if (!content.trim()) {
      alert('요약할 본문 내용이 없습니다. 에디터에 글을 먼저 작성해 주세요!');
      return;
    }

    aiSummaryBtn.innerText = "⏳ AI 요약 작성 중...";
    aiSummaryBtn.disabled = true;
    if (aiSummaryResultBox) aiSummaryResultBox.style.display = "none";

    const summaryPrompt = `
      당신은 훌륭한 요약 전문가입니다. 아래 제공되는 유저의 메모 본문을 정독하고, 핵심 내용을 가독성 좋게 요약해 주세요.
      
      [규칙]
      - 핵심 내용을 3줄 이내의 보기 좋은 글머리 기호(•) 형태로 요약하세요.
      - 불필요한 인사말이나 부연 설명 없이, 오직 요약된 핵심 문장만 답변하세요.

      [유저의 메모 본문]
      ${content}
    `;

    try {
      const response = await fetch(`https://generativelanguage.googleapis.com/v1/models/gemini-2.5-flash:generateContent`, {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "x-goog-api-key": GEMINI_API_KEY 
        },
        body: JSON.stringify({ contents: [{ parts: [{ text: summaryPrompt }] }] })
      });

      if (!response.ok) throw new Error("구글 AI 요약 서버 통신 실패");

      const data = await response.json();
      const summaryResult = data.candidates[0].content.parts[0].text.trim();

      latestSummaryContent = summaryResult;
      if (aiSummaryText) aiSummaryText.innerText = summaryResult;
      if (aiSummaryResultBox) aiSummaryResultBox.style.display = "block"; 

    } catch (error) {
      console.error("AI 요약 오류:", error);
      alert("AI 요약을 생성하는 중에 에러가 발생했습니다.");
    } finally {
      aiSummaryBtn.innerText = "📝 현재 본문 요약 생성";
      aiSummaryBtn.disabled = false;
    }
  });
}

if (aiSummarySaveBtn) {
  aiSummarySaveBtn.addEventListener('click', () => {
    if (!currentUserId || !latestSummaryContent) return;

    const originalTitle = document.getElementById('memo-title').value || "제목 없는 메모";
    const newSummaryTitle = `📌 [요약] ${originalTitle}`.substring(0, 20); 

    let targetFolderId = currentFolderId;
    if (!targetFolderId) {
      targetFolderId = Object.values(userFoldersMap)[0] || null;
      currentFolderId = targetFolderId;
    }

    if (!targetFolderId) {
      alert("요약을 저장할 폴더가 존재하지 않습니다.");
      return;
    }

    db.collection('users').doc(currentUserId).collection('memos').add({
      folderId: targetFolderId,
      title: newSummaryTitle,
      content: latestSummaryContent,
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    })
    .then(() => {
      alert(`'${newSummaryTitle}' 파일이 현재 폴더에 새 메모로 안전하게 생성되었습니다!`);
      if (aiSummaryResultBox) aiSummaryResultBox.style.display = "none";
      latestSummaryContent = "";
      if (currentFolderId) renderDashboardFiles(currentFolderId);
      switchCenterView('dashboard');
    })
    .catch((error) => {
      alert("요약본 파일 생성 실패: " + error.message);
    });
  });
}

const selectModeBtn = document.getElementById('select-mode-btn');
if (selectModeBtn) {
  selectModeBtn.addEventListener('click', () => {
    isSelectMode = !isSelectMode; 

    if (isSelectMode) {
      selectModeBtn.innerText = "선택 취소";
      selectModeBtn.classList.add('active');
      document.querySelectorAll('.memo-tree-item').forEach(li => {
        li.classList.add('select-mode-active');
      });
    } else {
      selectModeBtn.innerText = "메모 선택";
      selectModeBtn.classList.remove('active');
      document.querySelectorAll('.memo-checkbox').forEach(box => box.checked = false);
      document.querySelectorAll('.memo-tree-item').forEach(li => {
        li.classList.remove('select-mode-active');
      });
    }
  });
}

const toggleLeftBtn = document.getElementById('toggle-left-btn');
const toggleRightBtn = document.getElementById('toggle-right-btn');
const sidebarLeft = document.querySelector('.sidebar-left');
const sidebarRight = document.querySelector('.sidebar-right');

if (toggleLeftBtn && sidebarLeft) {
  toggleLeftBtn.addEventListener('click', (e) => {
    e.stopPropagation(); 
    const isCollapsed = sidebarLeft.classList.toggle('collapsed');
    toggleLeftBtn.innerText = isCollapsed ? "▶" : "◀";
  });
}

if (toggleRightBtn && sidebarRight) {
  toggleRightBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    const isCollapsed = sidebarRight.classList.toggle('collapsed');
    toggleRightBtn.innerText = isCollapsed ? "◀" : "▶";
  });
}

function switchCenterView(viewType) {
  currentCenterView = viewType;
  
  const editorForm = document.getElementById('memo-editor-form');
  const folderDashboard = document.getElementById('folder-dashboard');
  const backBtn = document.getElementById('memo-back-btn');

  if (!editorForm || !folderDashboard || !backBtn) return;

  if (viewType === 'editor') {
    editorForm.style.display = 'flex';
    folderDashboard.style.display = 'none';
    backBtn.style.display = activeFolderId ? 'block' : 'none'; 
  } else if (viewType === 'dashboard') {
    editorForm.style.display = 'none';
    folderDashboard.style.display = 'flex';
    backBtn.style.display = 'block'; 
  }
}

const memoBackBtnGlobal = document.getElementById('memo-back-btn');
if (memoBackBtnGlobal) {
  memoBackBtnGlobal.addEventListener('click', () => {
    if (currentCenterView === 'editor') {
      if (activeFolderId) {
        renderDashboardFiles(activeFolderId);
        switchCenterView('dashboard');
      } else {
        switchCenterView('editor');
      }
    } else if (currentCenterView === 'dashboard') {
      activeFolderId = null;
      clearMemoEditor();
      switchCenterView('editor');
    }
  });
}

