// 화면에 있는 요소들을 찾아 둬요
const input = document.getElementById("todo-input");
const authorInput = document.getElementById("author-input");
const addButton = document.getElementById("add-button");
const list = document.getElementById("todo-list");
const emptyMessage = document.getElementById("empty-message");
const errorMessage = document.getElementById("error-message");

// Supabase에 접속해요. 주소와 열쇠는 config.js에 있어요.
// (window.supabase는 index.html에서 인터넷으로 불러온 Supabase 라이브러리예요.
//  인터넷이 끊겨서 못 불러왔으면 db는 null로 남아요)
const db = window.supabase
  ? window.supabase.createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY)
  : null;

// 할 일 목록. Supabase의 todos 표 한 줄이 할 일 하나예요.
// 예: [{ id: 1, title: "장보기", author: "다인", is_done: false, created_at: "..." }]
// (작성자 이름을 안 적은 할 일은 author가 null이에요)
let todos = [];

// 처음에 Supabase에서 목록을 불러오는 중인지
let loading = true;

// 할 일 목록을 화면에 다시 그려요
function render() {
  list.innerHTML = "";

  for (const todo of todos) {
    const li = document.createElement("li");
    li.className = "todo-item" + (todo.is_done ? " done" : "");

    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.checked = todo.is_done;
    checkbox.addEventListener("change", () => toggleTodo(todo.id));

    const text = document.createElement("span");
    text.className = "todo-text";
    text.textContent = todo.title;

    const deleteButton = document.createElement("button");
    deleteButton.className = "delete-button";
    deleteButton.type = "button";
    deleteButton.textContent = "✕";
    deleteButton.title = "삭제";
    deleteButton.addEventListener("click", () => deleteTodo(todo.id));

    // 작성자 이름은 할 일 오른쪽에 작은 회색 글씨로 보여줘요. 이름이 없으면 안 붙여요.
    li.append(checkbox, text);
    if (todo.author) {
      const author = document.createElement("span");
      author.className = "todo-author";
      author.textContent = todo.author;
      li.append(author);
    }
    li.append(deleteButton);
    list.append(li);
  }

  // 불러오는 중이거나 할 일이 없을 때만 안내 문구를 보여줘요
  emptyMessage.textContent = loading ? "불러오는 중…" : "할 일이 없습니다 🎉";
  emptyMessage.hidden = !loading && todos.length > 0;
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

  // 저장하는 동안 버튼을 잠가서 두 번 추가되지 않게 해요
  addButton.disabled = true;

  const { data, error } = await db
    .from("todos")
    .insert({ title: title, author: author })
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

  // 할 일 칸만 비워요. 이름은 다음에도 쓰기 쉽게 그대로 둬요.
  input.value = "";
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

// 할 일 칸이나 이름 칸에서 Enter를 누르면 추가해요
function handleEnter(event) {
  // 한글을 조합하는 중(글자가 아직 완성되지 않은 상태)에 누른 Enter는 무시해요.
  // 이걸 안 하면 Enter 한 번에 할 일이 두 번 추가될 수 있어요.
  if (event.isComposing || event.keyCode === 229) return;

  // 저장 중에 Enter를 또 눌러도 두 번 추가되지 않게 해요
  if (event.key === "Enter" && !addButton.disabled) addTodo();
}

input.addEventListener("keydown", handleEnter);
authorInput.addEventListener("keydown", handleEnter);

// 처음 열었을 때 "불러오는 중"을 보여주고, Supabase에서 목록을 가져와요
render();
loadTodos();
