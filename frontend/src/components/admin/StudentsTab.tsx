import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, Pencil, Trash2, Plus, Upload } from "lucide-react";
import { toast } from "sonner";
import {
  getStudentsApi,
  createStudentApi,
  updateStudentApi,
  deleteStudentApi,
  getSectionsApi,
} from "@/api/axios";

interface Programme {
  id: number;
  name: string;
  duration_years: number;
}
interface Section {
  id: number;
  name: string;
  year: number;
  semester: number;
}
interface Student {
  id: number;
  first_name: string;
  last_name: string;
  student_id: string;
  email: string;
  parent_email: string;
  parent_telegram: string;
  section_name: string;
  section_year: number;
  programme_name: string;
}

interface StudentsTabProps {
  programmes: Programme[];
}

const StudentsTab = ({ programmes }: StudentsTabProps) => {
  const [students, setStudents] = useState<Student[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  // Filters
  const [filterProgramme, setFilterProgramme] = useState("");
  const [filterYear, setFilterYear] = useState("");
  const [filterSection, setFilterSection] = useState("");
  const [sections, setSections] = useState<Section[]>([]);
  const [years, setYears] = useState<number[]>([]);

  // Edit modal
  const [editOpen, setEditOpen] = useState(false);
  const [editStudent, setEditStudent] = useState<Student | null>(null);
  const [editForm, setEditForm] = useState({
    first_name: "",
    last_name: "",
    email: "",
    parent_email: "",
    parent_telegram: "",
  });
  const [saving, setSaving] = useState(false);

  // Add modal
  const [addOpen, setAddOpen] = useState(false);
  const [addForm, setAddForm] = useState({
    first_name: "",
    last_name: "",
    student_id: "",
    email: "",
    parent_email: "",
    parent_telegram: "",
    section_id: "",
  });
  const [addSections, setAddSections] = useState<Section[]>([]);
  const [addProgramme, setAddProgramme] = useState("");
  const [addYear, setAddYear] = useState("");
  const [adding, setAdding] = useState(false);

  // Bulk import
  const [importOpen, setImportOpen] = useState(false);

  useEffect(() => {
    fetchStudents();
  }, []);

  const fetchStudents = async () => {
    try {
      setLoading(true);
      const params: any = {};
      if (filterProgramme) params.programme = filterProgramme;
      if (filterYear) params.year = filterYear;
      if (filterSection) params.section = filterSection;
      if (search) params.search = search;
      const res = await getStudentsApi(params);
      setStudents(res.data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStudents();
  }, [filterProgramme, filterYear, filterSection]);

  // When filter programme changes — build year list
  useEffect(() => {
    if (!filterProgramme) {
      setYears([]);
      setSections([]);
      setFilterYear("");
      setFilterSection("");
      return;
    }
    const prog = programmes.find((p) => p.id === parseInt(filterProgramme));
    if (prog)
      setYears(Array.from({ length: prog.duration_years }, (_, i) => i + 1));
    setFilterYear("");
    setFilterSection("");
  }, [filterProgramme]);

  // When filter year changes — load sections
  useEffect(() => {
    if (!filterProgramme || !filterYear) {
      setSections([]);
      setFilterSection("");
      return;
    }
    getSectionsApi({
      programme: parseInt(filterProgramme),
      year: parseInt(filterYear),
    }).then((res) => setSections(res.data));
    setFilterSection("");
  }, [filterYear]);

  // Add modal — when programme/year changes load sections
  useEffect(() => {
    if (!addProgramme || !addYear) {
      setAddSections([]);
      return;
    }
    getSectionsApi({
      programme: parseInt(addProgramme),
      year: parseInt(addYear),
    }).then((res) => setAddSections(res.data));
  }, [addProgramme, addYear]);

  const openEdit = (student: Student) => {
    setEditStudent(student);
    setEditForm({
      first_name: student.first_name,
      last_name: student.last_name,
      email: student.email,
      parent_email: student.parent_email || "",
      parent_telegram: student.parent_telegram || "",
    });
    setEditOpen(true);
  };

  const handleSave = async () => {
    if (!editStudent) return;
    setSaving(true);
    try {
      await updateStudentApi(editStudent.id, editForm);
      setStudents((prev) =>
        prev.map((s) => (s.id === editStudent.id ? { ...s, ...editForm } : s)),
      );
      toast.success("Student updated!");
      setEditOpen(false);
    } catch {
      toast.error("Failed to update student");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Are you sure you want to delete this student?")) return;
    try {
      await deleteStudentApi(id);
      setStudents((prev) => prev.filter((s) => s.id !== id));
      toast.success("Student deleted!");
    } catch {
      toast.error("Failed to delete student");
    }
  };

  const handleAdd = async () => {
    if (
      !addForm.first_name ||
      !addForm.last_name ||
      !addForm.student_id ||
      !addForm.email ||
      !addForm.section_id
    ) {
      toast.error("Please fill all required fields");
      return;
    }
    setAdding(true);
    try {
      const res = await createStudentApi({
        first_name: addForm.first_name,
        last_name: addForm.last_name,
        student_id: addForm.student_id,
        email: addForm.email,
        parent_email: addForm.parent_email,
        parent_telegram: addForm.parent_telegram,
        section_id: parseInt(addForm.section_id),
      });
      setStudents((prev) => [...prev, res.data]);
      toast.success("Student added!");
      setAddOpen(false);
      setAddForm({
        first_name: "",
        last_name: "",
        student_id: "",
        email: "",
        parent_email: "",
        parent_telegram: "",
        section_id: "",
      });
      setAddProgramme("");
      setAddYear("");
    } catch (e: any) {
      toast.error(e?.response?.data?.error || "Failed to add student");
    } finally {
      setAdding(false);
    }
  };

  const handleBulkImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (ev) => {
      const text = ev.target?.result as string;
      const lines = text.split("\n").filter(Boolean);
      const headers = lines[0].split(",").map((h) => h.trim().toLowerCase());
      let imported = 0;
      for (let i = 1; i < lines.length; i++) {
        const values = lines[i].split(",").map((v) => v.trim());
        const row: any = {};
        headers.forEach((h, idx) => {
          row[h] = values[idx] || "";
        });
        if (!row["first_name"] || !row["student_id"] || !row["section_id"])
          continue;
        try {
          await createStudentApi({
            first_name: row["first_name"],
            last_name: row["last_name"] || "",
            student_id: row["student_id"],
            email: row["email"] || `${row["student_id"]}@eau.edu.et`,
            parent_email: row["parent_email"] || "",
            parent_telegram: row["parent_telegram"] || "",
            section_id: parseInt(row["section_id"]),
          });
          imported++;
        } catch {}
      }
      toast.success(`Imported ${imported} students!`);
      fetchStudents();
      setImportOpen(false);
    };
    reader.readAsText(file);
  };

  const filtered = students.filter((s) => {
    if (!search) return true;
    const name = `${s.first_name} ${s.last_name}`.toLowerCase();
    return (
      name.includes(search.toLowerCase()) ||
      s.student_id.toLowerCase().includes(search.toLowerCase()) ||
      s.email.toLowerCase().includes(search.toLowerCase())
    );
  });

  const addYears = addProgramme
    ? Array.from(
        {
          length:
            programmes.find((p) => p.id === parseInt(addProgramme))
              ?.duration_years || 4,
        },
        (_, i) => i + 1,
      )
    : [];

  return (
    <>
      <Card className="shadow-card border-border/50">
        <CardHeader className="pb-4">
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <CardTitle className="font-display text-base">
                Student Management
              </CardTitle>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  className="gap-1.5"
                  onClick={() => setImportOpen(true)}
                >
                  <Upload className="w-4 h-4" /> Import CSV
                </Button>
                <Button
                  size="sm"
                  className="gap-1.5 bg-primary hover:bg-primary/90"
                  onClick={() => setAddOpen(true)}
                >
                  <Plus className="w-4 h-4" /> Add Student
                </Button>
              </div>
            </div>

            {/* Filters */}
            <div className="flex flex-wrap gap-3 items-end">
              <select
                value={filterProgramme}
                onChange={(e) => setFilterProgramme(e.target.value)}
                className="border border-input rounded-lg px-3 py-2 text-sm bg-background outline-none focus:ring-2 focus:ring-ring"
              >
                <option value="">All Programmes</option>
                {programmes.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
              <select
                value={filterYear}
                onChange={(e) => setFilterYear(e.target.value)}
                disabled={!filterProgramme}
                className="border border-input rounded-lg px-3 py-2 text-sm bg-background outline-none focus:ring-2 focus:ring-ring disabled:opacity-50"
              >
                <option value="">All Years</option>
                {years.map((y) => (
                  <option key={y} value={y}>
                    Year {y}
                  </option>
                ))}
              </select>
              <select
                value={filterSection}
                onChange={(e) => setFilterSection(e.target.value)}
                disabled={!filterYear}
                className="border border-input rounded-lg px-3 py-2 text-sm bg-background outline-none focus:ring-2 focus:ring-ring disabled:opacity-50"
              >
                <option value="">All Sections</option>
                {sections.map((s) => (
                  <option key={s.id} value={s.id}>
                    Section {s.name}
                  </option>
                ))}
              </select>
              <div className="relative flex-1 min-w-48">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Search students..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && fetchStudents()}
                  className="pl-9 h-9 text-sm"
                />
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <table className="w-full text-sm">
            <thead className="border-y border-border bg-muted/30">
              <tr>
                <th className="text-left px-6 py-3 font-medium text-muted-foreground">
                  Name
                </th>
                <th className="text-left px-6 py-3 font-medium text-muted-foreground">
                  University ID
                </th>
                <th className="text-left px-6 py-3 font-medium text-muted-foreground">
                  Programme / Year
                </th>
                <th className="text-left px-6 py-3 font-medium text-muted-foreground">
                  Email
                </th>
                <th className="text-left px-6 py-3 font-medium text-muted-foreground">
                  Parent Telegram
                </th>
                <th className="text-left px-6 py-3 font-medium text-muted-foreground">
                  Parent Email
                </th>
                <th className="text-right px-6 py-3 font-medium text-muted-foreground">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {loading && (
                <tr>
                  <td
                    colSpan={7}
                    className="text-center py-12 text-muted-foreground"
                  >
                    Loading students...
                  </td>
                </tr>
              )}
              {!loading && filtered.length === 0 && (
                <tr>
                  <td
                    colSpan={7}
                    className="text-center py-12 text-muted-foreground"
                  >
                    No students found
                  </td>
                </tr>
              )}
              {filtered.map((s) => (
                <tr key={s.id} className="hover:bg-muted/20 transition-colors">
                  <td className="px-6 py-4 font-medium">
                    {s.first_name} {s.last_name}
                  </td>
                  <td className="px-6 py-4 font-mono text-xs text-primary">
                    {s.student_id}
                  </td>
                  <td className="px-6 py-4 text-muted-foreground text-xs">
                    <p>{s.programme_name}</p>
                    <p className="text-muted-foreground/60">
                      Year {s.section_year} · Section {s.section_name}
                    </p>
                  </td>
                  <td className="px-6 py-4 text-muted-foreground">{s.email}</td>
                  <td className="px-6 py-4 text-muted-foreground">
                    {s.parent_telegram ? (
                      <span className="text-blue-500">
                        @{s.parent_telegram.replace("@", "")}
                      </span>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="px-6 py-4 text-muted-foreground">
                    {s.parent_email || "—"}
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => openEdit(s)}
                        className="p-1.5 rounded-md hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(s.id)}
                        className="p-1.5 rounded-md hover:bg-destructive/10 transition-colors text-muted-foreground hover:text-destructive"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>

      {/* Edit Modal */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display">Edit Student</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  First Name
                </p>
                <input
                  value={editForm.first_name}
                  onChange={(e) =>
                    setEditForm({ ...editForm, first_name: e.target.value })
                  }
                  className="w-full border border-input rounded-lg px-3 py-2 text-sm bg-background outline-none focus:ring-2 focus:ring-ring"
                />
              </div>
              <div className="space-y-1.5">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  Last Name
                </p>
                <input
                  value={editForm.last_name}
                  onChange={(e) =>
                    setEditForm({ ...editForm, last_name: e.target.value })
                  }
                  className="w-full border border-input rounded-lg px-3 py-2 text-sm bg-background outline-none focus:ring-2 focus:ring-ring"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                Email
              </p>
              <input
                value={editForm.email}
                onChange={(e) =>
                  setEditForm({ ...editForm, email: e.target.value })
                }
                className="w-full border border-input rounded-lg px-3 py-2 text-sm bg-background outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
            <div className="space-y-1.5">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                Parent Telegram
              </p>
              <input
                value={editForm.parent_telegram}
                onChange={(e) =>
                  setEditForm({ ...editForm, parent_telegram: e.target.value })
                }
                placeholder="@username"
                className="w-full border border-input rounded-lg px-3 py-2 text-sm bg-background outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
            <div className="space-y-1.5">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                Parent Email
              </p>
              <input
                value={editForm.parent_email}
                onChange={(e) =>
                  setEditForm({ ...editForm, parent_email: e.target.value })
                }
                className="w-full border border-input rounded-lg px-3 py-2 text-sm bg-background outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setEditOpen(false)}>
                Cancel
              </Button>
              <Button
                onClick={handleSave}
                disabled={saving}
                className="bg-primary hover:bg-primary/90"
              >
                {saving ? "Saving..." : "Save Changes"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Add Student Modal */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="font-display">Add New Student</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  First Name *
                </p>
                <input
                  value={addForm.first_name}
                  onChange={(e) =>
                    setAddForm({ ...addForm, first_name: e.target.value })
                  }
                  className="w-full border border-input rounded-lg px-3 py-2 text-sm bg-background outline-none focus:ring-2 focus:ring-ring"
                />
              </div>
              <div className="space-y-1.5">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  Last Name *
                </p>
                <input
                  value={addForm.last_name}
                  onChange={(e) =>
                    setAddForm({ ...addForm, last_name: e.target.value })
                  }
                  className="w-full border border-input rounded-lg px-3 py-2 text-sm bg-background outline-none focus:ring-2 focus:ring-ring"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  Registration No *
                </p>
                <input
                  value={addForm.student_id}
                  onChange={(e) =>
                    setAddForm({ ...addForm, student_id: e.target.value })
                  }
                  placeholder="UGR/10001/24"
                  className="w-full border border-input rounded-lg px-3 py-2 text-sm bg-background outline-none focus:ring-2 focus:ring-ring"
                />
              </div>
              <div className="space-y-1.5">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  Email *
                </p>
                <input
                  value={addForm.email}
                  onChange={(e) =>
                    setAddForm({ ...addForm, email: e.target.value })
                  }
                  className="w-full border border-input rounded-lg px-3 py-2 text-sm bg-background outline-none focus:ring-2 focus:ring-ring"
                />
              </div>
            </div>
            {/* Section selector */}
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  Programme *
                </p>
                <select
                  value={addProgramme}
                  onChange={(e) => setAddProgramme(e.target.value)}
                  className="w-full border border-input rounded-lg px-3 py-2 text-sm bg-background outline-none focus:ring-2 focus:ring-ring"
                >
                  <option value="">Select</option>
                  {programmes.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  Year *
                </p>
                <select
                  value={addYear}
                  onChange={(e) => setAddYear(e.target.value)}
                  disabled={!addProgramme}
                  className="w-full border border-input rounded-lg px-3 py-2 text-sm bg-background outline-none focus:ring-2 focus:ring-ring disabled:opacity-50"
                >
                  <option value="">Select</option>
                  {addYears.map((y) => (
                    <option key={y} value={y}>
                      Year {y}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  Section *
                </p>
                <select
                  value={addForm.section_id}
                  onChange={(e) =>
                    setAddForm({ ...addForm, section_id: e.target.value })
                  }
                  disabled={!addYear}
                  className="w-full border border-input rounded-lg px-3 py-2 text-sm bg-background outline-none focus:ring-2 focus:ring-ring disabled:opacity-50"
                >
                  <option value="">Select</option>
                  {addSections.map((s) => (
                    <option key={s.id} value={s.id}>
                      Section {s.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  Parent Email
                </p>
                <input
                  value={addForm.parent_email}
                  onChange={(e) =>
                    setAddForm({ ...addForm, parent_email: e.target.value })
                  }
                  className="w-full border border-input rounded-lg px-3 py-2 text-sm bg-background outline-none focus:ring-2 focus:ring-ring"
                />
              </div>
              <div className="space-y-1.5">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  Parent Telegram
                </p>
                <input
                  value={addForm.parent_telegram}
                  onChange={(e) =>
                    setAddForm({ ...addForm, parent_telegram: e.target.value })
                  }
                  placeholder="@username"
                  className="w-full border border-input rounded-lg px-3 py-2 text-sm bg-background outline-none focus:ring-2 focus:ring-ring"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setAddOpen(false)}>
                Cancel
              </Button>
              <Button
                onClick={handleAdd}
                disabled={adding}
                className="bg-primary hover:bg-primary/90"
              >
                {adding ? "Adding..." : "Add Student"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Bulk Import Modal */}
      <Dialog open={importOpen} onOpenChange={setImportOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display">
              Bulk Import Students
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="p-4 bg-muted/30 rounded-lg text-sm text-muted-foreground space-y-2">
              <p className="font-medium text-foreground">
                CSV Format Required:
              </p>
              <p className="font-mono text-xs">
                first_name, last_name, student_id, email, section_id,
                parent_email, parent_telegram
              </p>
              <p>
                The <span className="font-medium">section_id</span> column must
                be the numeric ID of the section from the database.
              </p>
            </div>
            <div className="space-y-1.5">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                Upload CSV File
              </p>
              <input
                type="file"
                accept=".csv"
                onChange={handleBulkImport}
                className="w-full border border-input rounded-lg px-3 py-2 text-sm bg-background outline-none"
              />
            </div>
            <div className="flex justify-end">
              <Button variant="outline" onClick={() => setImportOpen(false)}>
                Close
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default StudentsTab;
