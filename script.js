// 화면에 있는 요소들을 찾아 둬요
const input = document.getElementById("todo-input");
const authorInput = document.getElementById("author-input");
const dueInput = document.getElementById("due-input");
const addButton = document.getElementById("add-button");
const list = document.getElementById("todo-list");
const emptyMessage = document.getElementById("empty-message");
const errorMessage = document.getElementById("error-message");
const filterButtons = document.querySelectorAll(".filter-button");
const remainingCount = document.getElementById("remaining-count");

// Supabase에 접속해요. 주소와 열쇠는 config.js에 있어요.
// (window.supabase는 index.html에서 인터넷으로 불러온 Supabase 라이브러리예요.
//  인터넷이 끊겨서 못 불러왔으면 db는 null로 남아요)
const db = window.supabase
  ? window.supabase.createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY)
  : null;

// 할 일 목록. Supabase의 todos 표 한 줄이 할 일 하나예요.
// 예: [{ id: 1, title: "장보기", author: "다인", due_date: "2026-10-15", is_done: false, created_at: "..." }]
// (작성자 이름이나 마감일을 안 적은 할 일은 author, due_date가 null이에요)
let todos = [];

// 처음에 Supabase에서 목록을 불러오는 중인지
let loading = true;

// 지금 고치고 있는 할 일의 id. 고치는 중이 아니면 null이에요.
let editingId = null;

// 어떤 할 일을 보여줄지: "all"(전체), "active"(진행 중), "done"(완료)
let filter = "all";

// 오늘 날짜를 "2026-10-12" 모양의 글자로 만들어요 (내 컴퓨터 시간 기준)
function todayString() {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return now.getFullYear() + "-" + month + "-" + day;
}

// "2026-10-15"를 "10월 15일"로 바꿔요
function formatDate(dateString) {
  const [, month, day] = dateString.split("-");
  return Number(month) + "월 " + Number(day) + "일";
}

// 마감이 가까운 순서로 줄 세워요. 마감일이 없는 할 일은 맨 아래로 가요.
// 마감일이 같으면 먼저 만든 할 일이 위에 와요.
function sortTodos() {
  todos.sort((a, b) => {
    if (a.due_date !== b.due_date) {
      if (a.due_date === null) return 1;
      if (b.due_date === null) return -1;
      // "2026-10-15" 같은 글자는 사전 순서가 곧 날짜 순서예요
      return a.due_date < b.due_date ? -1 : 1;
    }
    if (a.created_at !== b.created_at) return a.created_at < b.created_at ? -1 : 1;
    return a.id - b.id;
  });
}

// 할 일 목록을 화면에 다시 그려요
function render() {
  list.innerHTML = "";
  sortTodos();
  const today = todayString();

  // 고른 보기에 맞는 할 일만 골라요
  const visibleTodos = todos.filter((todo) => {
    if (filter === "active") return !todo.is_done;
    if (filter === "done") return todo.is_done;
    return true;
  });

  for (const todo of visibleTodos) {
    const li = document.createElement("li");
    li.className = "todo-item" + (todo.is_done ? " done" : "");

    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.checked = todo.is_done;
    checkbox.addEventListener("change", () => toggleTodo(todo.id));

    // 고치는 중인 할 일은 글자 대신 입력 칸을 보여줘요
    const text = todo.id === editingId ? createEditInput(todo) : document.createElement("span");
    if (todo.id !== editingId) {
      text.className = "todo-text";
      text.textContent = todo.title;
      text.title = "두 번 누르면 고칠 수 있어요";
      text.addEventListener("dblclick", () => startEdit(todo.id));
    }

    const deleteButton = document.createElement("button");
    deleteButton.className = "delete-button";
    deleteButton.type = "button";
    deleteButton.textContent = "✕";
    deleteButton.title = "삭제";
    deleteButton.addEventListener("click", () => deleteTodo(todo.id));

    // 작성자 이름은 할 일 오른쪽에 작은 회색 글씨로 보여줘요. 이름이 없으면 안 붙여요.
    li.append(checkbox, text);

    // 마감일은 할 일 오른쪽에 보여줘요. 오늘이 마감이면 주황색, 지났으면 빨간색이에요.
    // (이미 완료한 할 일은 색을 칠하지 않아요)
    if (todo.due_date) {
      const due = document.createElement("span");
      due.className = "todo-due";
      due.textContent = formatDate(todo.due_date);
      if (!todo.is_done && todo.due_date < today) {
        due.classList.add("overdue");
        due.title = "마감일이 지났어요";
      } else if (!todo.is_done && todo.due_date === today) {
        due.classList.add("due-today");
        due.title = "오늘이 마감이에요";
      }
      li.append(due);
    }

    if (todo.author) {
      const author = document.createElement("span");
      author.className = "todo-author";
      author.textContent = todo.author;
      li.append(author);
    }
    li.append(deleteButton);
    list.append(li);
  }

  // 불러오는 중이거나 보여줄 할 일이 없을 때만 안내 문구를 보여줘요
  if (loading) {
    emptyMessage.textContent = "불러오는 중…";
  } else if (todos.length === 0) {
    emptyMessage.textContent = "할 일이 없습니다 🎉";
  } else if (filter === "active") {
    emptyMessage.textContent = "진행 중인 할 일이 없어요 🎉";
  } else {
    emptyMessage.textContent = "완료한 할 일이 없어요";
  }
  emptyMessage.hidden = !loading && visibleTodos.length > 0;

  // 지금 고른 보기 버튼을 파랗게 칠해요
  for (const button of filterButtons) {
    const selected = button.dataset.filter === filter;
    button.classList.toggle("selected", selected);
    button.setAttribute("aria-pressed", selected);
  }

  // 남은(아직 완료하지 않은) 할 일 개수. 어떤 보기를 골랐든 전체에서 세요.
  const remaining = todos.filter((todo) => !todo.is_done).length;
  remainingCount.textContent = loading ? "" : "남은 할 일 " + remaining + "개";

  // 고치는 칸이 새로 생겼으면 커서를 넣고, 커서를 글자 맨 끝에 둬요
  const editInput = list.querySelector(".edit-input");
  if (editInput && document.activeElement !== editInput) {
    editInput.focus();
    editInput.setSelectionRange(editInput.value.length, editInput.value.length);
  }
}

// 할 일을 고치는 입력 칸을 만들어요. 원래 글자가 들어 있어요.
function createEditInput(todo) {
  const editInput = document.createElement("input");
  editInput.type = "text";
  editInput.className = "edit-input";
  editInput.value = todo.title;
  editInput.setAttribute("aria-label", "할 일 고치기");

  // 한글을 조합하는 중에 누른 Enter를 기억해 둬요 (아래 compositionend에서 써요)
  let enterWhileComposing = false;

  editInput.addEventListener("keydown", (event) => {
    if (event.isComposing || event.keyCode === 229) {
      // 마지막 글자가 아직 조합 중일 때 Enter를 누르면, 여기서 바로 저장하면
      // 마지막 글자가 잘릴 수 있어요. 글자가 완성된 뒤(compositionend)에 저장해요.
      if (event.key === "Enter") enterWhileComposing = true;
      return;
    }
    if (event.key === "Enter") saveEdit(todo.id, editInput.value);
    if (event.key === "Escape") cancelEdit();
  });

  editInput.addEventListener("compositionend", () => {
    if (!enterWhileComposing) return;
    enterWhileComposing = false;
    // 브라우저가 완성된 글자를 입력 칸에 넣을 때까지 아주 잠깐 기다렸다가 저장해요
    setTimeout(() => saveEdit(todo.id, editInput.value), 0);
  });

  // 다른 곳을 눌러서 칸을 벗어나도 저장해요
  editInput.addEventListener("blur", () => saveEdit(todo.id, editInput.value));

  return editInput;
}

// 할 일 고치기를 시작해요
function startEdit(id) {
  editingId = id;
  render();
}

// 고치기를 취소하고 원래 글자로 돌아가요
function cancelEdit() {
  if (editingId === null) return;
  editingId = null;
  render();
}

// 고친 글자를 저장해요
async function saveEdit(id, value) {
  // 이미 저장했거나 취소했으면 아무것도 안 해요.
  // (Enter와 칸 벗어나기가 거의 동시에 일어나도 한 번만 저장되게 해요)
  if (editingId !== id) return;
  editingId = null;

  const todo = todos.find((t) => t.id === id);
  const title = value.trim();

  // 글자를 다 지웠거나 바뀐 게 없으면 저장하지 않고 원래대로 둬요
  if (title === "" || title === todo.title) {
    render();
    return;
  }

  const { error } = await db.from("todos").update({ title: title }).eq("id", id);

  if (error) {
    showError("할 일을 고치지 못했어요: " + error.message);
  } else {
    showError("");
    todo.title = title;
  }
  // 실패했을 때도 다시 그려서 원래 글자로 되돌려요
  render();
}

// 오류를 화면에 보여줘요. 빈 글자를 넘기면 오류 칸을 숨겨요.
function showError(message) {
  errorMessage.textContent = message;
  errorMessage.hidden = message === "";
}

// Supabase에서 할 일 목록을 불러와요
async function loadTodos() {
  if (!db) {
    loading = false;
    showError("Supabase 라이브러리를 불러오지 못했어요. 인터넷 연결을 확인하고 새로고침해 주세요.");
    addButton.disabled = true;
    render();
    return;
  }

  const { data, error } = await db
    .from("todos")
    .select("*")
    .order("created_at")
    .order("id");

  loading = false;

  if (error) {
    showError("할 일을 불러오지 못했어요: " + error.message);
  } else {
    showError("");
    todos = data;
  }
  render();
}

// 새 할 일을 추가해요
async function addTodo() {
  const title = input.value.trim();
  if (title === "") return;

  // 이름은 안 적어도 돼요. 비어 있으면 null(값 없음)로 저장해요.
  const author = authorInput.value.trim() || null;

  // 년·월·일 중 일부만 적은 날짜는 브라우저가 "빈 값"으로 줘요.
  // 그대로 두면 날짜가 조용히 사라지니까, 끝까지 고르라고 알려줘요.
  if (dueInput.validity.badInput) {
    showError("마감일을 년·월·일까지 다 골라 주세요. (마감일이 필요 없으면 날짜 칸을 비워 주세요)");
    dueInput.focus();
    return;
  }

  // 마감일도 안 골라도 돼요. 날짜 칸이 비어 있으면 null로 저장해요.
  const dueDate = dueInput.value || null;

  // 저장하는 동안 버튼을 잠가서 두 번 추가되지 않게 해요
  addButton.disabled = true;

  const { data, error } = await db
    .from("todos")
    .insert({ title: title, author: author, due_date: dueDate })
    .select()
    .single();

  addButton.disabled = false;

  if (error) {
    // 실패하면 입력한 글자는 그대로 둬서 다시 시도할 수 있게 해요
    showError("할 일을 추가하지 못했어요: " + error.message);
    return;
  }

  showError("");
  todos.push(data);
  render();

  // 할 일 칸과 마감일 칸을 비워요. 이름은 다음에도 쓰기 쉽게 그대로 둬요.
  input.value = "";
  dueInput.value = "";
  input.focus();
}

// 완료 ↔ 미완료를 바꿔요
async function toggleTodo(id) {
  const todo = todos.find((t) => t.id === id);

  const { error } = await db
    .from("todos")
    .update({ is_done: !todo.is_done })
    .eq("id", id);

  if (error) {
    showError("완료 표시를 바꾸지 못했어요: " + error.message);
  } else {
    showError("");
    todo.is_done = !todo.is_done;
  }
  // 실패했을 때도 다시 그려서 체크 표시를 원래대로 되돌려요
  render();
}

// 할 일을 지워요
async function deleteTodo(id) {
  const { error } = await db.from("todos").delete().eq("id", id);

  if (error) {
    showError("할 일을 지우지 못했어요: " + error.message);
    return;
  }

  showError("");
  todos = todos.filter((t) => t.id !== id);
  render();
}

addButton.addEventListener("click", addTodo);

// 보기 버튼을 누르면 그 보기로 바꿔요
for (const button of filterButtons) {
  button.addEventListener("click", () => {
    filter = button.dataset.filter;
    render();
  });
}

// 할 일 칸, 이름 칸, 마감일 칸에서 Enter를 누르면 추가해요
function handleEnter(event) {
  // 한글을 조합하는 중(글자가 아직 완성되지 않은 상태)에 누른 Enter는 무시해요.
  // 이걸 안 하면 Enter 한 번에 할 일이 두 번 추가될 수 있어요.
  if (event.isComposing || event.keyCode === 229) return;

  // 저장 중에 Enter를 또 눌러도 두 번 추가되지 않게 해요
  if (event.key === "Enter" && !addButton.disabled) addTodo();
}

input.addEventListener("keydown", handleEnter);
authorInput.addEventListener("keydown", handleEnter);
dueInput.addEventListener("keydown", handleEnter);

// 처음 열었을 때 "불러오는 중"을 보여주고, Supabase에서 목록을 가져와요
render();
loadTodos();
