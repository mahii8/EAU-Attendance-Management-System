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
import axios from "@/api/axios";

interface Course {
  id: number;
  name: string;
  total_credit_hours: string;
  programme_name: string;
}

interface CoursesTabProps {
  courses: Course[];
}

const CoursesTab = ({ courses: initialCourses }: CoursesTabProps) => {
  const [courses, setCourses] = useState(initialCourses);
  const [editOpen, setEditOpen] = useState(false);
  const [editCourse, setEditCourse] = useState<Course | null>(null);
  const [form, setForm] = useState({ name: "", total_credit_hours: "" });
  const [saving, setSaving] = useState(false);

  const openEdit = (course: Course) => {
    setEditCourse(course);
    setForm({
      name: course.name,
      total_credit_hours: course.total_credit_hours,
    });
    setEditOpen(true);
  };

  const handleSave = async () => {
    if (!editCourse) return;
    setSaving(true);
    try {
      await axios.patch(`/courses/${editCourse.id}/`, form);
      setCourses((prev) =>
        prev.map((c) => (c.id === editCourse.id ? { ...c, ...form } : c)),
      );
      toast.success("Course updated!");
      setEditOpen(false);
    } catch {
      toast.error("Failed to update course");
    } finally {
      setSaving(false);
    }
  };

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
            onClick={() => toast.info("Add course coming soon!")}
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
                  Programme
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
                    colSpan={4}
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
                  <td className="px-6 py-4 text-muted-foreground">
                    {c.programme_name}
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
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="w-full border border-input rounded-lg px-3 py-2 text-sm bg-background outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
            <div className="space-y-1.5">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                Credit Hours
              </p>
              <input
                type="number"
                value={form.total_credit_hours}
                onChange={(e) =>
                  setForm({ ...form, total_credit_hours: e.target.value })
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
    </>
  );
};

export default CoursesTab;
