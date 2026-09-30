// 화면에 있는 요소들을 찾아 둬요
const input = document.getElementById("todo-input");
const addButton = document.getElementById("add-button");
const list = document.getElementById("todo-list");
const emptyMessage = document.getElementById("empty-message");

// 할 일 목록. 예: [{ id: 123, text: "장보기", done: false }]
// 저장하지 않으므로 새로고침하면 비어요.
let todos = [];

// 할 일 목록을 화면에 다시 그려요
function render() {
  list.innerHTML = "";

  for (const todo of todos) {
    const li = document.createElement("li");
    li.className = "todo-item" + (todo.done ? " done" : "");

    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.checked = todo.done;
    checkbox.addEventListener("change", () => toggleTodo(todo.id));

    const text = document.createElement("span");
    text.className = "todo-text";
    text.textContent = todo.text;

    const deleteButton = document.createElement("button");
    deleteButton.className = "delete-button";
    deleteButton.type = "button";
    deleteButton.textContent = "✕";
    deleteButton.title = "삭제";
    deleteButton.addEventListener("click", () => deleteTodo(todo.id));

    li.append(checkbox, text, deleteButton);
    list.append(li);
  }

  // 할 일이 없을 때만 안내 문구를 보여줘요
  emptyMessage.hidden = todos.length > 0;
}

// 새 할 일을 추가해요
function addTodo() {
  const text = input.value.trim();
  if (text === "") return;

  todos.push({ id: Date.now(), text: text, done: false });
  render();

  input.value = "";
  input.focus();
}

// 완료 ↔ 미완료를 바꿔요
function toggleTodo(id) {
  const todo = todos.find((t) => t.id === id);
  todo.done = !todo.done;
  render();
}

// 할 일을 지워요
function deleteTodo(id) {
  todos = todos.filter((t) => t.id !== id);
  render();
}

addButton.addEventListener("click", addTodo);

input.addEventListener("keydown", (event) => {
  // 한글을 조합하는 중(글자가 아직 완성되지 않은 상태)에 누른 Enter는 무시해요.
  // 이걸 안 하면 Enter 한 번에 할 일이 두 번 추가될 수 있어요.
  if (event.isComposing || event.keyCode === 229) return;

  if (event.key === "Enter") addTodo();
});

// 처음 열었을 때 한 번 그려요
render();
