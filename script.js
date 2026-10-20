"use strict";

/* =====================================
   KONFIGURASI
===================================== */

const PASSWORD = "akucintafisika";

const DAYS = ["Senin", "Selasa", "Rabu", "Kamis", "Jumat"];
const STUDENT_COUNT = 10;

const TASKS_TABLE = "portal_tasks";
const GROUPS_TABLE = "portal_groups";

/* =====================================
   ELEMEN HTML
===================================== */

const studentTable = document.getElementById("studentTable");
const groupTable = document.getElementById("groupTable");

const dialog = document.getElementById("taskDialog");
const form = document.getElementById("taskForm");

const personInput = document.getElementById("personNumber");
const dayInput = document.getElementById("taskDay");
const taskInput = document.getElementById("taskText");
const passwordInput = document.getElementById("password");

const dialogTitle = document.getElementById("dialogTitle");
const errorText = document.getElementById("error");
const deleteBtn = document.getElementById("deleteBtn");

const groupDialog = document.getElementById("groupDialog");
const groupForm = document.getElementById("groupForm");
const groupNumberInput = document.getElementById("groupNumber");
const groupPasswordInput = document.getElementById("groupPassword");
const groupError = document.getElementById("groupError");
const groupDialogTitle = document.getElementById("groupDialogTitle");
const deleteGroupBtn = document.getElementById("deleteGroupBtn");

const memberInputs = [
    document.getElementById("member1"),
    document.getElementById("member2"),
    document.getElementById("member3"),
    document.getElementById("member4"),
    document.getElementById("member5")
];

/* =====================================
   DATA (disimpan di memori, sumber asli = Supabase)
===================================== */

let tasks = {};
let groups = [];

let currentTarget = null;
let editingGroupIndex = null;

/* =====================================
   TUGAS SISWA <-> SUPABASE
===================================== */

function getKey(type, person, day) {
    return `${type}-${person}-${day}`;
}

async function loadTasksFromSupabase() {
    const { data, error } = await supabaseClient
        .from(TASKS_TABLE)
        .select("student_number, day, task");

    if (error) {
        console.error("Gagal memuat tugas:", error);
        return;
    }

    const loaded = {};

    data.forEach(row => {
        loaded[getKey("student", row.student_number, row.day)] = row.task;
    });

    tasks = loaded;
    renderTables();
}

async function saveTaskToSupabase(person, day, value) {
    const { error } = await supabaseClient
        .from(TASKS_TABLE)
        .upsert(
            { student_number: person, day: day, task: value },
            { onConflict: "student_number,day" }
        );

    if (error) {
        console.error("Gagal menyimpan tugas:", error);
        errorText.textContent =
            "Data gagal disimpan ke database. Coba lagi.";
        return false;
    }

    return true;
}

async function deleteTaskFromSupabase(person, day) {
    const { error } = await supabaseClient
        .from(TASKS_TABLE)
        .delete()
        .eq("student_number", person)
        .eq("day", day);

    if (error) {
        console.error("Gagal menghapus tugas:", error);
        errorText.textContent =
            "Data gagal dihapus dari database. Coba lagi.";
        return false;
    }

    return true;
}

/* =====================================
   KELOMPOK <-> SUPABASE
===================================== */

async function loadGroupsFromSupabase() {
    const { data, error } = await supabaseClient
        .from(GROUPS_TABLE)
        .select("group_number, members")
        .order("group_number", { ascending: true });

    if (error) {
        console.error("Gagal memuat kelompok:", error);
        return;
    }

    groups = data
        .map(row => row.members)
        .filter(members =>
            Array.isArray(members) &&
            members.length === 5 &&
            members.every(member => typeof member === "string")
        );

    renderTables();
}

/* Sinkronkan seluruh array groups ke database
   (nomor kelompok otomatis rapi setelah ada yang dihapus) */
async function saveGroupsToSupabase() {
    if (groups.length > 0) {
        const rows = groups.map((members, index) => ({
            group_number: index + 1,
            members: members
        }));

        const { error } = await supabaseClient
            .from(GROUPS_TABLE)
            .upsert(rows, { onConflict: "group_number" });

        if (error) {
            console.error("Gagal menyimpan kelompok:", error);
            groupError.textContent =
                "Data kelompok gagal disimpan ke database. Coba lagi.";
            return false;
        }
    }

    const { error: deleteError } = await supabaseClient
        .from(GROUPS_TABLE)
        .delete()
        .gt("group_number", groups.length);

    if (deleteError) {
        console.error("Gagal merapikan kelompok:", deleteError);
        groupError.textContent =
            "Data kelompok gagal disimpan ke database. Coba lagi.";
        return false;
    }

    return true;
}

/* =====================================
   TABEL TUGAS SISWA
===================================== */

function updatePersonOptions() {
    const previousValue = personInput.value;

    personInput.replaceChildren();

    const placeholder = document.createElement("option");
    placeholder.value = "";
    placeholder.textContent = "Pilih nomor";
    personInput.appendChild(placeholder);

    for (let i = 1; i <= STUDENT_COUNT; i++) {
        const option = document.createElement("option");

        option.value = String(i);
        option.textContent = `nomor ${i}`;

        personInput.appendChild(option);
    }

    if (previousValue) {
        personInput.value = previousValue;
    }
}

function createTaskCell(person, day) {
    const cell = document.createElement("td");
    const key = getKey("student", person, day);

    const value = typeof tasks[key] === "string"
        ? tasks[key]
        : "";

    cell.className = "task-cell";
    cell.tabIndex = 0;
    cell.setAttribute("role", "button");

    cell.setAttribute(
        "aria-label",
        `Siswa ${person}, ${day}` +
        (value ? `: ${value}` : ": sel kosong")
    );

    cell.textContent = value;

    if (value) {
        cell.classList.add("filled");
        cell.title = value;
    }

    cell.addEventListener("click", () => {
        openTaskDialog(person, day);
    });

    cell.addEventListener("keydown", event => {
        if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            openTaskDialog(person, day);
        }
    });

    return cell;
}

/* =====================================
   RENDER KEDUA TABEL
===================================== */

function renderTables() {
    studentTable.replaceChildren();
    groupTable.replaceChildren();

    for (let i = 1; i <= STUDENT_COUNT; i++) {
        const row = document.createElement("tr");
        const numberCell = document.createElement("td");

        numberCell.textContent = i;
        row.appendChild(numberCell);

        DAYS.forEach(day => {
            row.appendChild(createTaskCell(i, day));
        });

        studentTable.appendChild(row);
    }

    groups.forEach((members, index) => {
        const row = document.createElement("tr");

        row.tabIndex = 0;
        row.setAttribute("role", "button");
        row.setAttribute(
            "aria-label",
            `Edit Kelompok ${index + 1}`
        );

        const numberCell = document.createElement("td");
        numberCell.textContent = `Kelompok ${index + 1}`;
        row.appendChild(numberCell);

        for (let member = 0; member < 5; member++) {
            const cell = document.createElement("td");

            cell.textContent = members[member] || "—";
            row.appendChild(cell);
        }

        row.addEventListener("click", () => {
            openGroupDialog(index);
        });

        row.addEventListener("keydown", event => {
            if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                openGroupDialog(index);
            }
        });

        groupTable.appendChild(row);
    });
}

/* =====================================
   TAMBAH / EDIT TUGAS SISWA
===================================== */

function openTaskDialog(person = "", day = "") {
    currentTarget = null;

    form.reset();
    errorText.textContent = "";

    updatePersonOptions();

    if (person !== "") {
        personInput.value = String(person);
    }

    if (day) {
        dayInput.value = day;
    }

    const key = person && day
        ? getKey("student", person, day)
        : null;

    const existingTask = key &&
        typeof tasks[key] === "string"
        ? tasks[key]
        : "";

    if (key) {
        currentTarget = { person, day };
    }

    taskInput.value = existingTask;
    passwordInput.value = "";

    dialogTitle.textContent = existingTask
        ? "Edit Tugas Siswa"
        : "Tambahkan Tugas Siswa";

    deleteBtn.hidden = !existingTask;

    if (!dialog.open) {
        dialog.showModal();
    }

    passwordInput.focus();
}

document.getElementById("addStudentBtn").addEventListener(
    "click",
    () => openTaskDialog()
);

function closeDialog() {
    if (dialog.open) {
        dialog.close();
    }

    currentTarget = null;
    form.reset();
    errorText.textContent = "";
}

document.getElementById("cancelBtn").addEventListener(
    "click",
    closeDialog
);

document.getElementById("closeBtn").addEventListener(
    "click",
    closeDialog
);

/* Simpan tugas */
form.addEventListener("submit", async event => {
    event.preventDefault();
    errorText.textContent = "";

    if (passwordInput.value !== PASSWORD) {
        errorText.textContent =
            "Password salah. Tugas tidak disimpan.";

        passwordInput.select();
        return;
    }

    const person = Number(personInput.value);
    const day = dayInput.value;
    const value = taskInput.value.trim();

    if (
        !Number.isInteger(person) ||
        person < 1 ||
        person > STUDENT_COUNT ||
        !DAYS.includes(day)
    ) {
        errorText.textContent =
            "Silakan pilih nomor dan hari yang valid.";
        return;
    }

    if (!value) {
        errorText.textContent =
            "Isi tugas tidak boleh kosong.";

        taskInput.focus();
        return;
    }

    const saveBtn = document.getElementById("saveBtn");
    if (saveBtn) saveBtn.disabled = true;

    const ok = await saveTaskToSupabase(person, day, value);

    if (saveBtn) saveBtn.disabled = false;

    if (!ok) return;

    tasks[getKey("student", person, day)] = value;

    renderTables();
    closeDialog();
});

/* Hapus tugas */
deleteBtn.addEventListener("click", async () => {
    errorText.textContent = "";

    if (!currentTarget) {
        errorText.textContent =
            "Pilih tugas yang sudah terisi terlebih dahulu.";
        return;
    }

    if (passwordInput.value !== PASSWORD) {
        errorText.textContent =
            "Masukkan password yang benar sebelum menghapus tugas.";

        passwordInput.focus();
        return;
    }

    const { person, day } = currentTarget;
    const key = getKey("student", person, day);

    if (tasks[key] === undefined) {
        errorText.textContent = "Tugas tidak ditemukan.";
        return;
    }

    const confirmed = confirm(
        `Hapus tugas Siswa ${person} untuk hari ${day}?`
    );

    if (!confirmed) return;

    const ok = await deleteTaskFromSupabase(person, day);

    if (!ok) return;

    delete tasks[key];

    renderTables();
    closeDialog();
});

/* =====================================
   TAMBAH / EDIT KELOMPOK
===================================== */

function openGroupDialog(index = null) {
    editingGroupIndex = index;

    groupForm.reset();
    groupError.textContent = "";
    groupPasswordInput.value = "";

    const isEditing = index !== null;

    groupDialogTitle.textContent = isEditing
        ? `Edit Kelompok ${index + 1}`
        : "Tambahkan Kelompok";

    groupNumberInput.value = isEditing
        ? `Kelompok ${index + 1}`
        : `Kelompok ${groups.length + 1}`;

    memberInputs.forEach((input, memberIndex) => {
        input.value = isEditing
            ? groups[index][memberIndex]
            : "";
    });

    deleteGroupBtn.hidden = !isEditing;

    if (!groupDialog.open) {
        groupDialog.showModal();
    }
}

document.getElementById("addGroupBtn").addEventListener(
    "click",
    () => openGroupDialog()
);

function closeGroupDialog() {
    if (groupDialog.open) {
        groupDialog.close();
    }

    editingGroupIndex = null;
    groupForm.reset();
    groupError.textContent = "";
}

document.getElementById("closeGroupBtn").addEventListener(
    "click",
    closeGroupDialog
);

document.getElementById("cancelGroupBtn").addEventListener(
    "click",
    closeGroupDialog
);

/* Simpan kelompok baru atau edit kelompok */
groupForm.addEventListener("submit", async event => {
    event.preventDefault();
    groupError.textContent = "";

    if (groupPasswordInput.value !== PASSWORD) {
        groupError.textContent =
            "Password salah. Perubahan kelompok ditolak.";

        groupPasswordInput.select();
        return;
    }

    const members = memberInputs.map(input =>
        input.value.trim()
    );

    if (members.some(member => member === "")) {
        groupError.textContent =
            "Semua lima anggota kelompok wajib diisi.";
        return;
    }

    const previousGroups = JSON.stringify(groups);

    if (editingGroupIndex === null) {
        groups.push(members);
    } else {
        groups[editingGroupIndex] = members;
    }

    const ok = await saveGroupsToSupabase();

    if (!ok) {
        groups = JSON.parse(previousGroups);
        return;
    }

    renderTables();
    closeGroupDialog();
});

/* Hapus kelompok */
deleteGroupBtn.addEventListener("click", async () => {
    groupError.textContent = "";

    if (editingGroupIndex === null) {
        groupError.textContent =
            "Tidak ada kelompok yang dipilih.";
        return;
    }

    if (groupPasswordInput.value !== PASSWORD) {
        groupError.textContent =
            "Password salah. Kelompok tidak dihapus.";

        groupPasswordInput.focus();
        return;
    }

    const confirmed = confirm(
        `Apakah kamu yakin ingin menghapus Kelompok ${
            editingGroupIndex + 1
        }?`
    );

    if (!confirmed) return;

    const previousGroups = JSON.stringify(groups);

    groups.splice(editingGroupIndex, 1);

    const ok = await saveGroupsToSupabase();

    if (!ok) {
        groups = JSON.parse(previousGroups);
        return;
    }

    renderTables();
    closeGroupDialog();
});

/* =====================================
   INISIALISASI
===================================== */

updatePersonOptions();
renderTables();

loadTasksFromSupabase();
loadGroupsFromSupabase();

supabaseClient
    .channel("portal-changes")
    .on(
        "postgres_changes",
        { event: "*", schema: "public", table: TASKS_TABLE },
        () => loadTasksFromSupabase()
    )
    .on(
        "postgres_changes",
        { event: "*", schema: "public", table: GROUPS_TABLE },
        () => loadGroupsFromSupabase()
    )
    .subscribe();