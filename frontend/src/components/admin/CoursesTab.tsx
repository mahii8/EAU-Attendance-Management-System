import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { createCourseApi, updateCourseApi } from "@/api/axios";

interface Course {
  id: number;
  name: string;
  code: string;
  total_credit_hours: string;
  programme_name: string;
  year: number;
  semester: number;
}

interface Programme {
  id: number;
  name: string;
  duration_years: number;
}

interface CoursesTabProps {
  courses: Course[];
  programmes: Programme[];
  onCoursesChange: (courses: Course[]) => void;
}

const CoursesTab = ({
  courses: initialCourses,
  programmes,
  onCoursesChange,
}: CoursesTabProps) => {
  const [courses, setCourses] = useState(initialCourses);
  const [editOpen, setEditOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [editCourse, setEditCourse] = useState<Course | null>(null);
  const [editForm, setEditForm] = useState({
    name: "",
    code: "",
    total_credit_hours: "",
    year: "1",
    semester: "1",
  });
  const [addForm, setAddForm] = useState({
    name: "",
    code: "",
    total_credit_hours: "",
    programme_id: "",
    year: "1",
    semester: "1",
  });
  const [saving, setSaving] = useState(false);
  const [adding, setAdding] = useState(false);

  const updateLocal = (updated: Course[]) => {
    setCourses(updated);
    onCoursesChange(updated);
  };

  const openEdit = (course: Course) => {
    setEditCourse(course);
    setEditForm({
      name: course.name,
      code: course.code || "",
      total_credit_hours: course.total_credit_hours,
      year: String(course.year),
      semester: String(course.semester),
    });
    setEditOpen(true);
  };

  const handleSave = async () => {
    if (!editCourse) return;
    setSaving(true);
    try {
      const res = await updateCourseApi(editCourse.id, editForm);
      updateLocal(
        courses.map((c) =>
          c.id === editCourse.id ? { ...c, ...res.data } : c,
        ),
      );
      toast.success("Course updated!");
      setEditOpen(false);
    } catch {
      toast.error("Failed to update course");
    } finally {
      setSaving(false);
    }
  };

  const handleAdd = async () => {
    if (!addForm.name || !addForm.total_credit_hours || !addForm.programme_id) {
      toast.error("Name, credit hours and programme are required");
      return;
    }
    setAdding(true);
    try {
      const res = await createCourseApi({
        name: addForm.name,
        code: addForm.code,
        total_credit_hours: parseFloat(addForm.total_credit_hours),
        programme_id: parseInt(addForm.programme_id),
        year: parseInt(addForm.year),
        semester: parseInt(addForm.semester),
      });
      updateLocal([...courses, res.data]);
      toast.success("Course added!");
      setAddOpen(false);
      setAddForm({
        name: "",
        code: "",
        total_credit_hours: "",
        programme_id: "",
        year: "1",
        semester: "1",
      });
    } catch (e: any) {
      toast.error(e?.response?.data?.error || "Failed to add course");
    } finally {
      setAdding(false);
    }
  };

  const selectedProg = programmes.find(
    (p) => p.id === parseInt(addForm.programme_id),
  );
  const addYears = selectedProg
    ? Array.from({ length: selectedProg.duration_years }, (_, i) => i + 1)
    : [1, 2, 3, 4, 5];

  return (
    <>
      <Card className="shadow-card border-border/50">
        <CardHeader className="flex flex-row items-center justify-between pb-4">
          <CardTitle className="font-display text-base">
            Course Management
          </CardTitle>
          <Button
            size="sm"
            className="gap-1.5 bg-primary hover:bg-primary/90"
            onClick={() => setAddOpen(true)}
          >
            <Plus className="w-4 h-4" /> Add Course
          </Button>
        </CardHeader>
        <CardContent className="p-0">
          <table className="w-full text-sm">
            <thead className="border-y border-border bg-muted/30">
              <tr>
                <th className="text-left px-6 py-3 font-medium text-muted-foreground">
                  Course Name
                </th>
                <th className="text-left px-6 py-3 font-medium text-muted-foreground">
                  Code
                </th>
                <th className="text-left px-6 py-3 font-medium text-muted-foreground">
                  Programme
                </th>
                <th className="text-left px-6 py-3 font-medium text-muted-foreground">
                  Year / Sem
                </th>
                <th className="text-left px-6 py-3 font-medium text-muted-foreground">
                  Credit Hours
                </th>
                <th className="text-right px-6 py-3 font-medium text-muted-foreground">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {courses.length === 0 && (
                <tr>
                  <td
                    colSpan={6}
                    className="text-center py-12 text-muted-foreground"
                  >
                    No courses found
                  </td>
                </tr>
              )}
              {courses.map((c) => (
                <tr key={c.id} className="hover:bg-muted/20 transition-colors">
                  <td className="px-6 py-4 font-medium text-primary">
                    {c.name}
                  </td>
                  <td className="px-6 py-4 text-muted-foreground font-mono text-xs">
                    {c.code || "—"}
                  </td>
                  <td className="px-6 py-4 text-muted-foreground">
                    {c.programme_name}
                  </td>
                  <td className="px-6 py-4 text-muted-foreground">
                    Y{c.year} S{c.semester}
                  </td>
                  <td className="px-6 py-4 text-muted-foreground">
                    {c.total_credit_hours}
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => openEdit(c)}
                        className="p-1.5 rounded-md hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => toast.error("Delete coming soon!")}
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
            <DialogTitle className="font-display">Edit Course</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                Course Name
              </p>
              <input
                value={editForm.name}
                onChange={(e) =>
                  setEditForm({ ...editForm, name: e.target.value })
                }
                className="w-full border border-input rounded-lg px-3 py-2 text-sm bg-background outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  Course Code
                </p>
                <input
                  value={editForm.code}
                  onChange={(e) =>
                    setEditForm({ ...editForm, code: e.target.value })
                  }
                  className="w-full border border-input rounded-lg px-3 py-2 text-sm bg-background outline-none focus:ring-2 focus:ring-ring"
                />
              </div>
              <div className="space-y-1.5">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  Credit Hours
                </p>
                <input
                  type="number"
                  value={editForm.total_credit_hours}
                  onChange={(e) =>
                    setEditForm({
                      ...editForm,
                      total_credit_hours: e.target.value,
                    })
                  }
                  className="w-full border border-input rounded-lg px-3 py-2 text-sm bg-background outline-none focus:ring-2 focus:ring-ring"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  Year
                </p>
                <select
                  value={editForm.year}
                  onChange={(e) =>
                    setEditForm({ ...editForm, year: e.target.value })
                  }
                  className="w-full border border-input rounded-lg px-3 py-2 text-sm bg-background outline-none focus:ring-2 focus:ring-ring"
                >
                  {[1, 2, 3, 4, 5].map((y) => (
                    <option key={y} value={y}>
                      Year {y}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  Semester
                </p>
                <select
                  value={editForm.semester}
                  onChange={(e) =>
                    setEditForm({ ...editForm, semester: e.target.value })
                  }
                  className="w-full border border-input rounded-lg px-3 py-2 text-sm bg-background outline-none focus:ring-2 focus:ring-ring"
                >
                  <option value="1">Semester 1</option>
                  <option value="2">Semester 2</option>
                </select>
              </div>
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

      {/* Add Course Modal */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display">Add New Course</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                Course Name *
              </p>
              <input
                value={addForm.name}
                onChange={(e) =>
                  setAddForm({ ...addForm, name: e.target.value })
                }
                placeholder="e.g. Aerodynamics I"
                className="w-full border border-input rounded-lg px-3 py-2 text-sm bg-background outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  Course Code
                </p>
                <input
                  value={addForm.code}
                  onChange={(e) =>
                    setAddForm({ ...addForm, code: e.target.value })
                  }
                  placeholder="e.g. AERO201"
                  className="w-full border border-input rounded-lg px-3 py-2 text-sm bg-background outline-none focus:ring-2 focus:ring-ring"
                />
              </div>
              <div className="space-y-1.5">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  Credit Hours *
                </p>
                <input
                  type="number"
                  value={addForm.total_credit_hours}
                  onChange={(e) =>
                    setAddForm({
                      ...addForm,
                      total_credit_hours: e.target.value,
                    })
                  }
                  placeholder="e.g. 48"
                  className="w-full border border-input rounded-lg px-3 py-2 text-sm bg-background outline-none focus:ring-2 focus:ring-ring"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                Programme *
              </p>
              <select
                value={addForm.programme_id}
                onChange={(e) =>
                  setAddForm({ ...addForm, programme_id: e.target.value })
                }
                className="w-full border border-input rounded-lg px-3 py-2 text-sm bg-background outline-none focus:ring-2 focus:ring-ring"
              >
                <option value="">Select programme</option>
                {programmes.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  Year *
                </p>
                <select
                  value={addForm.year}
                  onChange={(e) =>
                    setAddForm({ ...addForm, year: e.target.value })
                  }
                  className="w-full border border-input rounded-lg px-3 py-2 text-sm bg-background outline-none focus:ring-2 focus:ring-ring"
                >
                  {addYears.map((y) => (
                    <option key={y} value={y}>
                      Year {y}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  Semester *
                </p>
                <select
                  value={addForm.semester}
                  onChange={(e) =>
                    setAddForm({ ...addForm, semester: e.target.value })
                  }
                  className="w-full border border-input rounded-lg px-3 py-2 text-sm bg-background outline-none focus:ring-2 focus:ring-ring"
                >
                  <option value="1">Semester 1</option>
                  <option value="2">Semester 2</option>
                </select>
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
                {adding ? "Adding..." : "Add Course"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default CoursesTab;
