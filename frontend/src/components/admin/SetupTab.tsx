import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Plus,
  Pencil,
  Trash2,
  ChevronRight,
  CheckCircle,
  Calendar,
  BookOpen,
  Users,
  GraduationCap,
  Layers,
} from "lucide-react";
import { toast } from "sonner";
import {
  getAcademicYearsApi,
  createAcademicYearApi,
  updateAcademicYearApi,
  deleteAcademicYearApi,
  getSemestersApi,
  createSemesterApi,
  updateSemesterApi,
  deleteSemesterApi,
  getProgrammesApi,
  createProgrammeApi,
  updateProgrammeApi,
  deleteProgrammeApi,
  getSectionsApi,
  createSectionApi,
  deleteSectionApi,
  getOfferingsApi,
  createOfferingApi,
  updateOfferingApi,
  deleteOfferingApi,
  getCoursesApi,
  getUsersApi,
  getStudentsApi,
  getEnrollmentsApi,
  createEnrollmentApi,
  deleteEnrollmentApi,
  bulkEnrollApi,
} from "@/api/axios";

// ─── Types ───────────────────────────────────────────────────────────────────
interface AcademicYear {
  id: number;
  name: string;
  start_date: string;
  end_date: string;
  is_current: boolean;
  semester_count: number;
}
interface Semester {
  id: number;
  academic_year: number;
  academic_year_name: string;
  number: number;
  start_date: string;
  end_date: string;
  is_current: boolean;
  label: string;
  section_count: number;
}
interface Programme {
  id: number;
  name: string;
  code: string;
  duration_years: number;
  is_active: boolean;
}
interface Section {
  id: number;
  name: string;
  programme: number;
  programme_name: string;
  year: number;
  semester: number;
  semester_label: string;
  student_count: number;
}
interface Offering {
  id: number;
  course: number;
  course_name: string;
  section: number;
  section_name: string;
  section_year: number;
  programme_name: string;
  teacher: number | null;
  teacher_name: string | null;
  semester_label: string;
}
interface Course {
  id: number;
  name: string;
  programme: number;
  year: number;
}
interface Student {
  id: number;
  full_name: string;
  student_id: string;
  programme_name: string;
}
interface Enrollment {
  id: number;
  student: number;
  student_name: string;
  student_id_number: string;
  section: number;
  status: string;
}
interface User {
  id: number;
  full_name: string;
  role: string;
}

// ─── Step indicator ───────────────────────────────────────────────────────────
const steps = [
  { id: "years", label: "Academic Years", icon: Calendar },
  { id: "semesters", label: "Semesters", icon: Layers },
  { id: "programmes", label: "Programmes", icon: GraduationCap },
  { id: "sections", label: "Sections", icon: Users },
  { id: "offerings", label: "Course Offerings", icon: BookOpen },
];

// ─── Main component ────────────────────────────────────────────────────────────
const SetupTab = () => {
  const [activeStep, setActiveStep] = useState("years");

  // Data
  const [years, setYears] = useState<AcademicYear[]>([]);
  const [semesters, setSemesters] = useState<Semester[]>([]);
  const [programmes, setProgrammes] = useState<Programme[]>([]);
  const [sections, setSections] = useState<Section[]>([]);
  const [offerings, setOfferings] = useState<Offering[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [teachers, setTeachers] = useState<User[]>([]);

  // Filters for sections/offerings
  const [filterSemester, setFilterSemester] = useState("");
  const [filterProgramme, setFilterProgramme] = useState("");

  useEffect(() => {
    getProgrammesApi().then((r) => setProgrammes(r.data));
    getCoursesApi().then((r) => setCourses(r.data));
    getUsersApi({ role: "teacher" }).then((r) => setTeachers(r.data));
    getAcademicYearsApi().then((r) => setYears(r.data));
    getSemestersApi().then((r) => setSemesters(r.data));
  }, []);

  useEffect(() => {
    const params: any = {};
    if (filterSemester) params.semester = filterSemester;
    if (filterProgramme) params.programme = filterProgramme;
    getSectionsApi(params).then((r) => setSections(r.data));
  }, [filterSemester, filterProgramme]);

  useEffect(() => {
    const params: any = {};
    if (filterSemester) params.semester = filterSemester;
    if (filterProgramme) params.programme = filterProgramme;
    getOfferingsApi(params).then((r) => setOfferings(r.data));
  }, [filterSemester, filterProgramme]);

  return (
    <div className="space-y-6">
      {/* Step navigation */}
      <Card className="shadow-card border-border/50">
        <CardContent className="p-4">
          <div className="flex items-center gap-1 flex-wrap">
            {steps.map((step, i) => {
              const Icon = step.icon;
              const isActive = activeStep === step.id;
              return (
                <div key={step.id} className="flex items-center gap-1">
                  <button
                    onClick={() => setActiveStep(step.id)}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                      isActive
                        ? "bg-primary text-primary-foreground"
                        : "text-muted-foreground hover:bg-muted hover:text-foreground"
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    {step.label}
                  </button>
                  {i < steps.length - 1 && (
                    <ChevronRight className="w-4 h-4 text-muted-foreground/40" />
                  )}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Step content */}
      {activeStep === "years" && (
        <AcademicYearsPanel years={years} setYears={setYears} />
      )}
      {activeStep === "semesters" && (
        <SemestersPanel
          semesters={semesters}
          setSemesters={setSemesters}
          years={years}
        />
      )}
      {activeStep === "programmes" && (
        <ProgrammesPanel
          programmes={programmes}
          setProgrammes={setProgrammes}
        />
      )}
      {activeStep === "sections" && (
        <SectionsPanel
          sections={sections}
          setSections={setSections}
          semesters={semesters}
          programmes={programmes}
          filterSemester={filterSemester}
          setFilterSemester={setFilterSemester}
          filterProgramme={filterProgramme}
          setFilterProgramme={setFilterProgramme}
        />
      )}
      {activeStep === "offerings" && (
        <OfferingsPanel
          offerings={offerings}
          setOfferings={setOfferings}
          sections={sections}
          courses={courses}
          teachers={teachers}
          semesters={semesters}
          programmes={programmes}
          filterSemester={filterSemester}
          setFilterSemester={setFilterSemester}
          filterProgramme={filterProgramme}
          setFilterProgramme={setFilterProgramme}
        />
      )}
    </div>
  );
};

// ─── Academic Years Panel ─────────────────────────────────────────────────────
const AcademicYearsPanel = ({
  years,
  setYears,
}: {
  years: AcademicYear[];
  setYears: any;
}) => {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<AcademicYear | null>(null);
  const [form, setForm] = useState({
    name: "",
    start_date: "",
    end_date: "",
    is_current: false,
  });
  const [saving, setSaving] = useState(false);

  const openAdd = () => {
    setEditing(null);
    setForm({ name: "", start_date: "", end_date: "", is_current: false });
    setOpen(true);
  };
  const openEdit = (y: AcademicYear) => {
    setEditing(y);
    setForm({
      name: y.name,
      start_date: y.start_date,
      end_date: y.end_date,
      is_current: y.is_current,
    });
    setOpen(true);
  };

  const handleDelete = async (id: number) => {
    if (
      !confirm(
        "Delete this academic year? All semesters and sections inside it will also be deleted.",
      )
    )
      return;
    try {
      await deleteAcademicYearApi(id);
      setYears((prev: AcademicYear[]) => prev.filter((y) => y.id !== id));
      toast.success("Academic year deleted.");
    } catch {
      toast.error("Failed to delete academic year");
    }
  };

  const handleSave = async () => {
    if (!form.name || !form.start_date || !form.end_date) {
      toast.error("All fields are required");
      return;
    }
    setSaving(true);
    try {
      if (editing) {
        const res = await updateAcademicYearApi(editing.id, form);
        setYears((prev: AcademicYear[]) =>
          prev.map((y) => (y.id === editing.id ? res.data : y)),
        );
        toast.success("Academic year updated!");
      } else {
        const res = await createAcademicYearApi(form);
        setYears((prev: AcademicYear[]) => [...prev, res.data]);
        toast.success("Academic year created!");
      }
      setOpen(false);
    } catch (e: any) {
      toast.error(e?.response?.data?.error || "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <Card className="shadow-card border-border/50">
        <CardHeader className="flex flex-row items-center justify-between pb-4">
          <div>
            <CardTitle className="font-display text-base">
              Academic Years
            </CardTitle>
            <p className="text-xs text-muted-foreground mt-1">
              Define the academic years for the institution
            </p>
          </div>
          <Button
            size="sm"
            className="gap-1.5 bg-primary hover:bg-primary/90"
            onClick={openAdd}
          >
            <Plus className="w-4 h-4" /> Add Year
          </Button>
        </CardHeader>
        <CardContent className="p-0">
          <table className="w-full text-sm">
            <thead className="border-y border-border bg-muted/30">
              <tr>
                <th className="text-left px-6 py-3 font-medium text-muted-foreground">
                  Name
                </th>
                <th className="text-left px-6 py-3 font-medium text-muted-foreground">
                  Start Date
                </th>
                <th className="text-left px-6 py-3 font-medium text-muted-foreground">
                  End Date
                </th>
                <th className="text-left px-6 py-3 font-medium text-muted-foreground">
                  Semesters
                </th>
                <th className="text-left px-6 py-3 font-medium text-muted-foreground">
                  Status
                </th>
                <th className="text-right px-6 py-3 font-medium text-muted-foreground">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {years.length === 0 && (
                <tr>
                  <td
                    colSpan={6}
                    className="text-center py-12 text-muted-foreground"
                  >
                    No academic years yet. Add one to get started.
                  </td>
                </tr>
              )}
              {years.map((y) => (
                <tr key={y.id} className="hover:bg-muted/20 transition-colors">
                  <td className="px-6 py-4 font-medium">{y.name}</td>
                  <td className="px-6 py-4 text-muted-foreground">
                    {y.start_date}
                  </td>
                  <td className="px-6 py-4 text-muted-foreground">
                    {y.end_date}
                  </td>
                  <td className="px-6 py-4 text-muted-foreground">
                    {y.semester_count}
                  </td>
                  <td className="px-6 py-4">
                    {y.is_current && (
                      <span className="flex items-center gap-1 text-xs text-primary font-medium">
                        <CheckCircle className="w-3.5 h-3.5" /> Current
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        onClick={() => openEdit(y)}
                        className="p-1.5 rounded-md hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(y.id)}
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

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display">
              {editing ? "Edit Academic Year" : "Add Academic Year"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                Name *
              </p>
              <input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="e.g. 2024/2025"
                className="w-full border border-input rounded-lg px-3 py-2 text-sm bg-background outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  Start Date *
                </p>
                <input
                  type="date"
                  value={form.start_date}
                  onChange={(e) =>
                    setForm({ ...form, start_date: e.target.value })
                  }
                  className="w-full border border-input rounded-lg px-3 py-2 text-sm bg-background outline-none focus:ring-2 focus:ring-ring"
                />
              </div>
              <div className="space-y-1.5">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  End Date *
                </p>
                <input
                  type="date"
                  value={form.end_date}
                  onChange={(e) =>
                    setForm({ ...form, end_date: e.target.value })
                  }
                  className="w-full border border-input rounded-lg px-3 py-2 text-sm bg-background outline-none focus:ring-2 focus:ring-ring"
                />
              </div>
            </div>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={form.is_current}
                onChange={(e) =>
                  setForm({ ...form, is_current: e.target.checked })
                }
                className="w-4 h-4"
              />
              <span className="text-sm">Set as current academic year</span>
            </label>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button
                onClick={handleSave}
                disabled={saving}
                className="bg-primary hover:bg-primary/90"
              >
                {saving ? "Saving..." : "Save"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

// ─── Semesters Panel ──────────────────────────────────────────────────────────
const SemestersPanel = ({
  semesters,
  setSemesters,
  years,
}: {
  semesters: Semester[];
  setSemesters: any;
  years: AcademicYear[];
}) => {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Semester | null>(null);
  const [form, setForm] = useState({
    academic_year_id: "",
    number: "1",
    start_date: "",
    end_date: "",
    is_current: false,
  });
  const [saving, setSaving] = useState(false);

  const openAdd = () => {
    setEditing(null);
    setForm({
      academic_year_id: "",
      number: "1",
      start_date: "",
      end_date: "",
      is_current: false,
    });
    setOpen(true);
  };
  const openEdit = (s: Semester) => {
    setEditing(s);
    setForm({
      academic_year_id: String(s.academic_year),
      number: String(s.number),
      start_date: s.start_date,
      end_date: s.end_date,
      is_current: s.is_current,
    });
    setOpen(true);
  };

  const handleDelete = async (id: number) => {
    if (
      !confirm(
        "Delete this semester? All sections inside it will also be deleted.",
      )
    )
      return;
    try {
      await deleteSemesterApi(id);
      setSemesters((prev: Semester[]) => prev.filter((s) => s.id !== id));
      toast.success("Semester deleted.");
    } catch {
      toast.error("Failed to delete semester");
    }
  };

  const handleSave = async () => {
    if (!form.academic_year_id || !form.start_date || !form.end_date) {
      toast.error("All fields are required");
      return;
    }
    setSaving(true);
    try {
      if (editing) {
        const res = await updateSemesterApi(editing.id, form);
        setSemesters((prev: Semester[]) =>
          prev.map((s) => (s.id === editing.id ? res.data : s)),
        );
        toast.success("Semester updated!");
      } else {
        const res = await createSemesterApi({
          ...form,
          academic_year_id: parseInt(form.academic_year_id),
          number: parseInt(form.number),
        });
        setSemesters((prev: Semester[]) => [...prev, res.data]);
        toast.success("Semester created!");
      }
      setOpen(false);
    } catch (e: any) {
      toast.error(e?.response?.data?.error || "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <Card className="shadow-card border-border/50">
        <CardHeader className="flex flex-row items-center justify-between pb-4">
          <div>
            <CardTitle className="font-display text-base">Semesters</CardTitle>
            <p className="text-xs text-muted-foreground mt-1">
              Add Semester 1 and Semester 2 for each academic year
            </p>
          </div>
          <Button
            size="sm"
            className="gap-1.5 bg-primary hover:bg-primary/90"
            onClick={openAdd}
          >
            <Plus className="w-4 h-4" /> Add Semester
          </Button>
        </CardHeader>
        <CardContent className="p-0">
          <table className="w-full text-sm">
            <thead className="border-y border-border bg-muted/30">
              <tr>
                <th className="text-left px-6 py-3 font-medium text-muted-foreground">
                  Semester
                </th>
                <th className="text-left px-6 py-3 font-medium text-muted-foreground">
                  Academic Year
                </th>
                <th className="text-left px-6 py-3 font-medium text-muted-foreground">
                  Start Date
                </th>
                <th className="text-left px-6 py-3 font-medium text-muted-foreground">
                  End Date
                </th>
                <th className="text-left px-6 py-3 font-medium text-muted-foreground">
                  Sections
                </th>
                <th className="text-left px-6 py-3 font-medium text-muted-foreground">
                  Status
                </th>
                <th className="text-right px-6 py-3 font-medium text-muted-foreground">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {semesters.length === 0 && (
                <tr>
                  <td
                    colSpan={7}
                    className="text-center py-12 text-muted-foreground"
                  >
                    No semesters yet. Create an academic year first, then add
                    semesters.
                  </td>
                </tr>
              )}
              {semesters.map((s) => (
                <tr key={s.id} className="hover:bg-muted/20 transition-colors">
                  <td className="px-6 py-4 font-medium">Semester {s.number}</td>
                  <td className="px-6 py-4 text-muted-foreground">
                    {s.academic_year_name}
                  </td>
                  <td className="px-6 py-4 text-muted-foreground">
                    {s.start_date}
                  </td>
                  <td className="px-6 py-4 text-muted-foreground">
                    {s.end_date}
                  </td>
                  <td className="px-6 py-4 text-muted-foreground">
                    {s.section_count}
                  </td>
                  <td className="px-6 py-4">
                    {s.is_current && (
                      <span className="flex items-center gap-1 text-xs text-primary font-medium">
                        <CheckCircle className="w-3.5 h-3.5" /> Current
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-1">
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

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display">
              {editing ? "Edit Semester" : "Add Semester"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                Academic Year *
              </p>
              <select
                value={form.academic_year_id}
                onChange={(e) =>
                  setForm({ ...form, academic_year_id: e.target.value })
                }
                className="w-full border border-input rounded-lg px-3 py-2 text-sm bg-background outline-none focus:ring-2 focus:ring-ring"
              >
                <option value="">Select academic year</option>
                {years.map((y) => (
                  <option key={y.id} value={y.id}>
                    {y.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                Semester Number *
              </p>
              <select
                value={form.number}
                onChange={(e) => setForm({ ...form, number: e.target.value })}
                className="w-full border border-input rounded-lg px-3 py-2 text-sm bg-background outline-none focus:ring-2 focus:ring-ring"
              >
                <option value="1">Semester 1</option>
                <option value="2">Semester 2</option>
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  Start Date *
                </p>
                <input
                  type="date"
                  value={form.start_date}
                  onChange={(e) =>
                    setForm({ ...form, start_date: e.target.value })
                  }
                  className="w-full border border-input rounded-lg px-3 py-2 text-sm bg-background outline-none focus:ring-2 focus:ring-ring"
                />
              </div>
              <div className="space-y-1.5">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  End Date *
                </p>
                <input
                  type="date"
                  value={form.end_date}
                  onChange={(e) =>
                    setForm({ ...form, end_date: e.target.value })
                  }
                  className="w-full border border-input rounded-lg px-3 py-2 text-sm bg-background outline-none focus:ring-2 focus:ring-ring"
                />
              </div>
            </div>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={form.is_current}
                onChange={(e) =>
                  setForm({ ...form, is_current: e.target.checked })
                }
                className="w-4 h-4"
              />
              <span className="text-sm">Set as current semester</span>
            </label>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button
                onClick={handleSave}
                disabled={saving}
                className="bg-primary hover:bg-primary/90"
              >
                {saving ? "Saving..." : "Save"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

// ─── Programmes Panel ─────────────────────────────────────────────────────────
const ProgrammesPanel = ({
  programmes,
  setProgrammes,
}: {
  programmes: Programme[];
  setProgrammes: any;
}) => {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Programme | null>(null);
  const [form, setForm] = useState({ name: "", code: "", duration_years: "4" });
  const [saving, setSaving] = useState(false);

  const openAdd = () => {
    setEditing(null);
    setForm({ name: "", code: "", duration_years: "4" });
    setOpen(true);
  };
  const openEdit = (p: Programme) => {
    setEditing(p);
    setForm({
      name: p.name,
      code: p.code,
      duration_years: String(p.duration_years),
    });
    setOpen(true);
  };

  const handleDelete = async (id: number) => {
    if (
      !confirm(
        "Delete this programme? All associated courses and sections will also be removed.",
      )
    )
      return;
    try {
      await deleteProgrammeApi(id);
      setProgrammes((prev: Programme[]) => prev.filter((p) => p.id !== id));
      toast.success("Programme deleted.");
    } catch {
      toast.error("Failed to delete programme");
    }
  };

  const handleSave = async () => {
    if (!form.name) {
      toast.error("Programme name is required");
      return;
    }
    setSaving(true);
    try {
      const payload = {
        name: form.name,
        code: form.code,
        duration_years: parseInt(form.duration_years),
      };
      if (editing) {
        const res = await updateProgrammeApi(editing.id, payload);
        setProgrammes((prev: Programme[]) =>
          prev.map((p) => (p.id === editing.id ? res.data : p)),
        );
        toast.success("Programme updated!");
      } else {
        const res = await createProgrammeApi(payload);
        setProgrammes((prev: Programme[]) => [...prev, res.data]);
        toast.success("Programme added!");
      }
      setOpen(false);
    } catch (e: any) {
      toast.error(e?.response?.data?.error || "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <Card className="shadow-card border-border/50">
        <CardHeader className="flex flex-row items-center justify-between pb-4">
          <div>
            <CardTitle className="font-display text-base">Programmes</CardTitle>
            <p className="text-xs text-muted-foreground mt-1">
              Define the study programmes offered by the institution
            </p>
          </div>
          <Button
            size="sm"
            className="gap-1.5 bg-primary hover:bg-primary/90"
            onClick={openAdd}
          >
            <Plus className="w-4 h-4" /> Add Programme
          </Button>
        </CardHeader>
        <CardContent className="p-0">
          <table className="w-full text-sm">
            <thead className="border-y border-border bg-muted/30">
              <tr>
                <th className="text-left px-6 py-3 font-medium text-muted-foreground">
                  Name
                </th>
                <th className="text-left px-6 py-3 font-medium text-muted-foreground">
                  Code
                </th>
                <th className="text-left px-6 py-3 font-medium text-muted-foreground">
                  Duration
                </th>
                <th className="text-right px-6 py-3 font-medium text-muted-foreground">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {programmes.length === 0 && (
                <tr>
                  <td
                    colSpan={4}
                    className="text-center py-12 text-muted-foreground"
                  >
                    No programmes yet.
                  </td>
                </tr>
              )}

              {programmes.map((p) => (
                <tr key={p.id} className="hover:bg-muted/20 transition-colors">
                  <td className="px-6 py-4 font-medium">{p.name}</td>

                  <td className="px-6 py-4 text-muted-foreground font-mono text-xs">
                    {p.code || "—"}
                  </td>

                  <td className="px-6 py-4 text-muted-foreground">
                    {p.duration_years} years
                  </td>

                  {/* ✅ FIXED: only ONE td, properly structured */}
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        onClick={() => openEdit(p)}
                        className="p-1.5 rounded-md hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>

                      <button
                        onClick={() => handleDelete(p.id)}
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

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <div className="space-y-4 pt-2">
              <div className="space-y-1.5">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  Programme Name *
                </p>
                <input
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="e.g. Aircraft Maintenance Engineering"
                  className="w-full border border-input rounded-lg px-3 py-2 text-sm bg-background outline-none focus:ring-2 focus:ring-ring"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                    Code
                  </p>
                  <input
                    value={form.code}
                    onChange={(e) => setForm({ ...form, code: e.target.value })}
                    placeholder="e.g. AME"
                    className="w-full border border-input rounded-lg px-3 py-2 text-sm bg-background outline-none focus:ring-2 focus:ring-ring"
                  />
                </div>
                <div className="space-y-1.5">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                    Duration (years)
                  </p>
                  <select
                    value={form.duration_years}
                    onChange={(e) =>
                      setForm({ ...form, duration_years: e.target.value })
                    }
                    className="w-full border border-input rounded-lg px-3 py-2 text-sm bg-background outline-none focus:ring-2 focus:ring-ring"
                  >
                    {[2, 3, 4, 5].map((y) => (
                      <option key={y} value={y}>
                        {y} years
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <Button variant="outline" onClick={() => setOpen(false)}>
                  Cancel
                </Button>
                <Button
                  onClick={handleSave}
                  disabled={saving}
                  className="bg-primary hover:bg-primary/90"
                >
                  {saving ? "Saving..." : "Save"}
                </Button>
              </div>
            </div>
          </DialogHeader>
        </DialogContent>
      </Dialog>
    </>
  );
};

// ─── Sections Panel ───────────────────────────────────────────────────────────
const SectionsPanel = ({
  sections,
  setSections,
  semesters,
  programmes,
  filterSemester,
  setFilterSemester,
  filterProgramme,
  setFilterProgramme,
}: any) => {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    name: "",
    programme_id: "",
    year: "1",
    semester_id: "",
  });
  const [saving, setSaving] = useState(false);

  const selectedProg = programmes.find(
    (p: Programme) => p.id === parseInt(form.programme_id),
  );
  const years = selectedProg
    ? Array.from(
        { length: selectedProg.duration_years },
        (_: any, i: number) => i + 1,
      )
    : [1, 2, 3, 4];

  const handleSave = async () => {
    if (!form.name || !form.programme_id || !form.semester_id) {
      toast.error("All fields are required");
      return;
    }
    setSaving(true);
    try {
      const res = await createSectionApi({
        name: form.name,
        programme_id: parseInt(form.programme_id),
        year: parseInt(form.year),
        semester_id: parseInt(form.semester_id),
      });
      setSections((prev: Section[]) => [...prev, res.data]);
      toast.success("Section created!");
      setOpen(false);
      setForm({ name: "", programme_id: "", year: "1", semester_id: "" });
    } catch (e: any) {
      toast.error(e?.response?.data?.error || "Failed to create section");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Delete this section? All enrollments will be removed."))
      return;
    try {
      await deleteSectionApi(id);
      setSections((prev: Section[]) =>
        prev.filter((s: Section) => s.id !== id),
      );
      toast.success("Section deleted.");
    } catch {
      toast.error("Failed to delete section");
    }
  };

  // ── Manage Students ──────────────────────────────────────────────────────────
  const [manageOpen, setManageOpen] = useState(false);
  const [managingSection, setManagingSection] = useState<Section | null>(null);
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [allStudents, setAllStudents] = useState<Student[]>([]);
  const [enrollLoading, setEnrollLoading] = useState(false);
  const [studentSearch, setStudentSearch] = useState("");
  const [manageTab, setManageTab] = useState<"search" | "csv">("search");

  // CSV import state
  const [csvText, setCsvText] = useState("");
  const [csvImporting, setCsvImporting] = useState(false);
  const [csvPreview, setCsvPreview] = useState<
    { id: string; found?: number; name?: string; error?: string }[]
  >([]);
  const [csvParsed, setCsvParsed] = useState(false);

  const openManage = async (s: Section) => {
    setManagingSection(s);
    setManageOpen(true);
    setManageTab("search");
    setCsvText("");
    setCsvPreview([]);
    setCsvParsed(false);
    setStudentSearch("");
    setEnrollLoading(true);
    try {
      const [enrollRes, studentRes] = await Promise.all([
        getEnrollmentsApi({ section: s.id }),
        getStudentsApi({ active_only: true }),
      ]);
      setEnrollments(enrollRes.data);
      setAllStudents(studentRes.data);
    } catch {
      toast.error("Failed to load students");
    } finally {
      setEnrollLoading(false);
    }
  };

  const enrolledIds = new Set(enrollments.map((e: Enrollment) => e.student));

  const handleEnroll = async (studentId: number) => {
    if (!managingSection) return;
    try {
      const res = await createEnrollmentApi({
        student_id: studentId,
        section_id: managingSection.id,
      });
      setEnrollments((prev) => [...prev, res.data]);
      setSections((prev: Section[]) =>
        prev.map((s: Section) =>
          s.id === managingSection.id
            ? { ...s, student_count: s.student_count + 1 }
            : s,
        ),
      );
      toast.success("Student enrolled!");
    } catch (e: any) {
      toast.error(e?.response?.data?.error || "Failed to enroll");
    }
  };

  const handleUnenroll = async (enrollmentId: number, studentId: number) => {
    if (!confirm("Remove this student from the section?")) return;
    try {
      await deleteEnrollmentApi(enrollmentId);
      setEnrollments((prev) =>
        prev.filter((e: Enrollment) => e.id !== enrollmentId),
      );
      setSections((prev: Section[]) =>
        prev.map((s: Section) =>
          s.id === managingSection?.id
            ? { ...s, student_count: Math.max(0, s.student_count - 1) }
            : s,
        ),
      );
      toast.success("Student removed.");
    } catch {
      toast.error("Failed to remove student");
    }
  };

  const filteredAvailable = allStudents.filter(
    (s: Student) =>
      !enrolledIds.has(s.id) &&
      (studentSearch === "" ||
        s.full_name.toLowerCase().includes(studentSearch.toLowerCase()) ||
        s.student_id.toLowerCase().includes(studentSearch.toLowerCase())),
  );

  // ── CSV helpers ───────────────────────────────────────────────────────────
  const parseCsvIds = (raw: string): string[] =>
    raw
      .split(/[\n,]+/)
      .map((s) => s.trim())
      .filter(Boolean);

  const handleCsvPreview = () => {
    const ids = parseCsvIds(csvText);
    if (ids.length === 0) {
      toast.error("Paste at least one student ID");
      return;
    }
    const preview = ids.map((id) => {
      const student = allStudents.find((s: Student) => s.student_id === id);
      if (!student) return { id, error: "Not found" };
      if (enrolledIds.has(student.id))
        return {
          id,
          found: student.id,
          name: student.full_name,
          error: "Already enrolled",
        };
      return { id, found: student.id, name: student.full_name };
    });
    setCsvPreview(preview);
    setCsvParsed(true);
  };

  const handleCsvImport = async () => {
    if (!managingSection) return;
    const toEnroll = csvPreview
      .filter((r) => r.found && !r.error)
      .map((r) => r.found as number);
    if (toEnroll.length === 0) {
      toast.error("No valid students to import");
      return;
    }
    setCsvImporting(true);
    try {
      const res = await bulkEnrollApi({
        section_id: managingSection.id,
        student_ids: toEnroll,
      });
      const { enrolled } = res.data;
      // Refresh enrollments list
      const enrollRes = await getEnrollmentsApi({
        section: managingSection.id,
      });
      setEnrollments(enrollRes.data);
      setSections((prev: Section[]) =>
        prev.map((s: Section) =>
          s.id === managingSection.id
            ? { ...s, student_count: s.student_count + enrolled }
            : s,
        ),
      );
      toast.success(
        `Imported ${enrolled} student${enrolled !== 1 ? "s" : ""}!`,
      );
      setCsvText("");
      setCsvPreview([]);
      setCsvParsed(false);
      setManageTab("search");
    } catch (e: any) {
      toast.error(e?.response?.data?.error || "Import failed");
    } finally {
      setCsvImporting(false);
    }
  };

  return (
    <>
      <Card className="shadow-card border-border/50">
        <CardHeader className="pb-4">
          <div className="flex flex-row items-start justify-between">
            <div>
              <CardTitle className="font-display text-base">Sections</CardTitle>
              <p className="text-xs text-muted-foreground mt-1">
                Create student groups per programme, year, and semester
              </p>
            </div>
            <Button
              size="sm"
              className="gap-1.5 bg-primary hover:bg-primary/90"
              onClick={() => setOpen(true)}
            >
              <Plus className="w-4 h-4" /> Add Section
            </Button>
          </div>
          <div className="flex gap-3 mt-3 flex-wrap">
            <select
              value={filterSemester}
              onChange={(e) => setFilterSemester(e.target.value)}
              className="border border-input rounded-lg px-3 py-2 text-sm bg-background outline-none focus:ring-2 focus:ring-ring"
            >
              <option value="">All Semesters</option>
              {semesters.map((s: Semester) => (
                <option key={s.id} value={s.id}>
                  {s.label} {s.is_current ? "(Current)" : ""}
                </option>
              ))}
            </select>
            <select
              value={filterProgramme}
              onChange={(e) => setFilterProgramme(e.target.value)}
              className="border border-input rounded-lg px-3 py-2 text-sm bg-background outline-none focus:ring-2 focus:ring-ring"
            >
              <option value="">All Programmes</option>
              {programmes.map((p: Programme) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <table className="w-full text-sm">
            <thead className="border-y border-border bg-muted/30">
              <tr>
                <th className="text-left px-6 py-3 font-medium text-muted-foreground">
                  Section
                </th>
                <th className="text-left px-6 py-3 font-medium text-muted-foreground">
                  Programme
                </th>
                <th className="text-left px-6 py-3 font-medium text-muted-foreground">
                  Year
                </th>
                <th className="text-left px-6 py-3 font-medium text-muted-foreground">
                  Semester
                </th>
                <th className="text-left px-6 py-3 font-medium text-muted-foreground">
                  Students
                </th>
                <th className="text-right px-6 py-3 font-medium text-muted-foreground">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {sections.length === 0 && (
                <tr>
                  <td
                    colSpan={6}
                    className="text-center py-12 text-muted-foreground"
                  >
                    No sections found. Select a semester to filter or add a new
                    section.
                  </td>
                </tr>
              )}
              {sections.map((s: Section) => (
                <tr key={s.id} className="hover:bg-muted/20 transition-colors">
                  <td className="px-6 py-4 font-medium">Section {s.name}</td>
                  <td className="px-6 py-4 text-muted-foreground">
                    {s.programme_name}
                  </td>
                  <td className="px-6 py-4 text-muted-foreground">
                    Year {s.year}
                  </td>
                  <td className="px-6 py-4 text-muted-foreground">
                    {s.semester_label}
                  </td>
                  <td className="px-6 py-4 text-muted-foreground">
                    {s.student_count}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        onClick={() => openManage(s)}
                        className="flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium bg-primary/10 text-primary hover:bg-primary/20 transition-colors"
                      >
                        <Users className="w-3 h-3" /> Manage Students
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

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display">Add Section</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  Section Name *
                </p>
                <input
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="e.g. A, B, C"
                  className="w-full border border-input rounded-lg px-3 py-2 text-sm bg-background outline-none focus:ring-2 focus:ring-ring"
                />
              </div>
              <div className="space-y-1.5">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  Year *
                </p>
                <select
                  value={form.year}
                  onChange={(e) => setForm({ ...form, year: e.target.value })}
                  className="w-full border border-input rounded-lg px-3 py-2 text-sm bg-background outline-none focus:ring-2 focus:ring-ring"
                >
                  {years.map((y: number) => (
                    <option key={y} value={y}>
                      Year {y}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="space-y-1.5">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                Programme *
              </p>
              <select
                value={form.programme_id}
                onChange={(e) =>
                  setForm({ ...form, programme_id: e.target.value })
                }
                className="w-full border border-input rounded-lg px-3 py-2 text-sm bg-background outline-none focus:ring-2 focus:ring-ring"
              >
                <option value="">Select programme</option>
                {programmes.map((p: Programme) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                Semester *
              </p>
              <select
                value={form.semester_id}
                onChange={(e) =>
                  setForm({ ...form, semester_id: e.target.value })
                }
                className="w-full border border-input rounded-lg px-3 py-2 text-sm bg-background outline-none focus:ring-2 focus:ring-ring"
              >
                <option value="">Select semester</option>
                {semesters.map((s: Semester) => (
                  <option key={s.id} value={s.id}>
                    {s.label} {s.is_current ? "(Current)" : ""}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button
                onClick={handleSave}
                disabled={saving}
                className="bg-primary hover:bg-primary/90"
              >
                {saving ? "Saving..." : "Add Section"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Manage Students Dialog */}
      <Dialog open={manageOpen} onOpenChange={setManageOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-display">
              Manage Students — Section {managingSection?.name} (
              {managingSection?.semester_label})
            </DialogTitle>
          </DialogHeader>
          {enrollLoading ? (
            <div className="py-8 text-center text-muted-foreground text-sm">
              Loading...
            </div>
          ) : (
            <div className="space-y-5 pt-2">
              {/* Enrolled list */}
              <div>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">
                  Enrolled ({enrollments.length})
                </p>
                {enrollments.length === 0 ? (
                  <p className="text-sm text-muted-foreground italic">
                    No students enrolled yet.
                  </p>
                ) : (
                  <div className="border border-border rounded-lg divide-y divide-border max-h-44 overflow-y-auto">
                    {enrollments.map((e: Enrollment) => (
                      <div
                        key={e.id}
                        className="flex items-center justify-between px-4 py-2.5"
                      >
                        <div>
                          <p className="text-sm font-medium">
                            {e.student_name}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {e.student_id_number}
                          </p>
                        </div>
                        <button
                          onClick={() => handleUnenroll(e.id, e.student)}
                          className="text-xs text-destructive hover:underline px-2 py-1"
                        >
                          Remove
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Tab switcher */}
              <div className="flex gap-1 border-b border-border pb-0">
                <button
                  onClick={() => setManageTab("search")}
                  className={`px-4 py-2 text-sm font-medium rounded-t-lg transition-colors ${
                    manageTab === "search"
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted"
                  }`}
                >
                  Search & Add
                </button>
                <button
                  onClick={() => setManageTab("csv")}
                  className={`px-4 py-2 text-sm font-medium rounded-t-lg transition-colors ${
                    manageTab === "csv"
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted"
                  }`}
                >
                  Import by Student ID
                </button>
              </div>

              {/* Search tab */}
              {manageTab === "search" && (
                <div>
                  <input
                    placeholder="Search by name or student ID..."
                    value={studentSearch}
                    onChange={(e) => setStudentSearch(e.target.value)}
                    className="w-full border border-input rounded-lg px-3 py-2 text-sm bg-background outline-none focus:ring-2 focus:ring-ring mb-2"
                  />
                  <div className="border border-border rounded-lg divide-y divide-border max-h-56 overflow-y-auto">
                    {filteredAvailable.length === 0 && (
                      <p className="text-sm text-muted-foreground italic px-4 py-3">
                        {studentSearch
                          ? "No students match your search."
                          : "All students are already enrolled or no students exist."}
                      </p>
                    )}
                    {filteredAvailable.map((s: Student) => (
                      <div
                        key={s.id}
                        className="flex items-center justify-between px-4 py-2.5"
                      >
                        <div>
                          <p className="text-sm font-medium">{s.full_name}</p>
                          <p className="text-xs text-muted-foreground">
                            {s.student_id} · {s.programme_name}
                          </p>
                        </div>
                        <button
                          onClick={() => handleEnroll(s.id)}
                          className="text-xs font-medium text-primary hover:underline px-2 py-1 bg-primary/10 rounded"
                        >
                          + Enroll
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* CSV import tab */}
              {manageTab === "csv" && (
                <div className="space-y-3">
                  <p className="text-xs text-muted-foreground">
                    Paste student IDs separated by commas or new lines (e.g.{" "}
                    <code className="bg-muted px-1 rounded">
                      STU001, STU002
                    </code>
                    ). Students must already exist in the system.
                  </p>
                  <textarea
                    rows={5}
                    value={csvText}
                    onChange={(e) => {
                      setCsvText(e.target.value);
                      setCsvParsed(false);
                      setCsvPreview([]);
                    }}
                    placeholder={"STU001\nSTU002\nSTU003"}
                    className="w-full border border-input rounded-lg px-3 py-2 text-sm bg-background outline-none focus:ring-2 focus:ring-ring font-mono resize-none"
                  />

                  {!csvParsed ? (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={handleCsvPreview}
                      disabled={!csvText.trim()}
                    >
                      Preview
                    </Button>
                  ) : (
                    <>
                      <div className="border border-border rounded-lg divide-y divide-border max-h-52 overflow-y-auto text-sm">
                        {csvPreview.map((row, i) => (
                          <div
                            key={i}
                            className={`flex items-center justify-between px-4 py-2 ${
                              row.error ? "bg-destructive/5" : "bg-green-500/5"
                            }`}
                          >
                            <div>
                              <span className="font-mono font-medium">
                                {row.id}
                              </span>
                              {row.name && (
                                <span className="ml-2 text-muted-foreground">
                                  {row.name}
                                </span>
                              )}
                            </div>
                            <span
                              className={`text-xs px-2 py-0.5 rounded-full ${
                                row.error
                                  ? "bg-destructive/10 text-destructive"
                                  : "bg-green-500/10 text-green-700 dark:text-green-400"
                              }`}
                            >
                              {row.error ?? "Ready"}
                            </span>
                          </div>
                        ))}
                      </div>
                      <div className="flex items-center gap-3">
                        <p className="text-xs text-muted-foreground flex-1">
                          {csvPreview.filter((r) => !r.error).length} will be
                          enrolled, {csvPreview.filter((r) => !!r.error).length}{" "}
                          skipped
                        </p>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setCsvParsed(false);
                            setCsvPreview([]);
                          }}
                        >
                          Edit
                        </Button>
                        <Button
                          size="sm"
                          className="bg-primary hover:bg-primary/90"
                          onClick={handleCsvImport}
                          disabled={
                            csvImporting ||
                            csvPreview.filter((r) => !r.error).length === 0
                          }
                        >
                          {csvImporting ? "Importing..." : "Import"}
                        </Button>
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
};

// ─── Course Offerings Panel ───────────────────────────────────────────────────
const OfferingsPanel = ({
  offerings,
  setOfferings,
  sections,
  courses,
  teachers,
  semesters,
  programmes,
  filterSemester,
  setFilterSemester,
  filterProgramme,
  setFilterProgramme,
}: any) => {
  const [open, setOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editing, setEditing] = useState<Offering | null>(null);
  const [form, setForm] = useState({
    course_id: "",
    section_id: "",
    teacher_id: "",
  });
  const [editTeacher, setEditTeacher] = useState("");
  const [saving, setSaving] = useState(false);

  // Filter sections by semester
  const filteredSections = sections.filter(
    (s: Section) => !filterSemester || String(s.semester) === filterSemester,
  );

  const handleAdd = async () => {
    if (!form.course_id || !form.section_id) {
      toast.error("Course and section are required");
      return;
    }
    setSaving(true);
    try {
      const res = await createOfferingApi({
        course_id: parseInt(form.course_id),
        section_id: parseInt(form.section_id),
        teacher_id: form.teacher_id ? parseInt(form.teacher_id) : undefined,
      });
      setOfferings((prev: Offering[]) => [...prev, res.data]);
      toast.success("Course offering created!");
      setOpen(false);
      setForm({ course_id: "", section_id: "", teacher_id: "" });
    } catch (e: any) {
      toast.error(e?.response?.data?.error || "Failed to create offering");
    } finally {
      setSaving(false);
    }
  };

  const handleEditTeacher = async () => {
    if (!editing) return;
    setSaving(true);
    try {
      const res = await updateOfferingApi(editing.id, {
        teacher_id: editTeacher ? parseInt(editTeacher) : undefined,
      });
      setOfferings((prev: Offering[]) =>
        prev.map((o: Offering) => (o.id === editing.id ? res.data : o)),
      );
      toast.success("Teacher updated!");
      setEditOpen(false);
    } catch {
      toast.error("Failed to update teacher");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Remove this course offering?")) return;
    try {
      await deleteOfferingApi(id);
      setOfferings((prev: Offering[]) =>
        prev.filter((o: Offering) => o.id !== id),
      );
      toast.success("Offering removed.");
    } catch {
      toast.error("Failed to remove offering");
    }
  };

  return (
    <>
      <Card className="shadow-card border-border/50">
        <CardHeader className="pb-4">
          <div className="flex flex-row items-start justify-between">
            <div>
              <CardTitle className="font-display text-base">
                Course Offerings
              </CardTitle>
              <p className="text-xs text-muted-foreground mt-1">
                Assign course templates to sections and teachers for each
                semester
              </p>
            </div>
            <Button
              size="sm"
              className="gap-1.5 bg-primary hover:bg-primary/90"
              onClick={() => setOpen(true)}
            >
              <Plus className="w-4 h-4" /> Add Offering
            </Button>
          </div>
          <div className="flex gap-3 mt-3 flex-wrap">
            <select
              value={filterSemester}
              onChange={(e) => setFilterSemester(e.target.value)}
              className="border border-input rounded-lg px-3 py-2 text-sm bg-background outline-none focus:ring-2 focus:ring-ring"
            >
              <option value="">All Semesters</option>
              {semesters.map((s: Semester) => (
                <option key={s.id} value={s.id}>
                  {s.label} {s.is_current ? "(Current)" : ""}
                </option>
              ))}
            </select>
            <select
              value={filterProgramme}
              onChange={(e) => setFilterProgramme(e.target.value)}
              className="border border-input rounded-lg px-3 py-2 text-sm bg-background outline-none focus:ring-2 focus:ring-ring"
            >
              <option value="">All Programmes</option>
              {programmes.map((p: Programme) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <table className="w-full text-sm">
            <thead className="border-y border-border bg-muted/30">
              <tr>
                <th className="text-left px-6 py-3 font-medium text-muted-foreground">
                  Course
                </th>
                <th className="text-left px-6 py-3 font-medium text-muted-foreground">
                  Section
                </th>
                <th className="text-left px-6 py-3 font-medium text-muted-foreground">
                  Programme
                </th>
                <th className="text-left px-6 py-3 font-medium text-muted-foreground">
                  Semester
                </th>
                <th className="text-left px-6 py-3 font-medium text-muted-foreground">
                  Teacher
                </th>
                <th className="text-right px-6 py-3 font-medium text-muted-foreground">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {offerings.length === 0 && (
                <tr>
                  <td
                    colSpan={6}
                    className="text-center py-12 text-muted-foreground"
                  >
                    No course offerings found. Add sections and courses first.
                  </td>
                </tr>
              )}
              {offerings.map((o: Offering) => (
                <tr key={o.id} className="hover:bg-muted/20 transition-colors">
                  <td className="px-6 py-4 font-medium text-primary">
                    {o.course_name}
                  </td>
                  <td className="px-6 py-4 text-muted-foreground">
                    Sec {o.section_name} Y{o.section_year}
                  </td>
                  <td className="px-6 py-4 text-muted-foreground">
                    {o.programme_name}
                  </td>
                  <td className="px-6 py-4 text-muted-foreground">
                    {o.semester_label}
                  </td>
                  <td className="px-6 py-4 text-muted-foreground">
                    {o.teacher_name || (
                      <span className="text-destructive/70 text-xs">
                        Unassigned
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => {
                          setEditing(o);
                          setEditTeacher(o.teacher ? String(o.teacher) : "");
                          setEditOpen(true);
                        }}
                        className="p-1.5 rounded-md hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(o.id)}
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

      {/* Add Offering Modal */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display">
              Add Course Offering
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                Course *
              </p>
              <select
                value={form.course_id}
                onChange={(e) =>
                  setForm({ ...form, course_id: e.target.value })
                }
                className="w-full border border-input rounded-lg px-3 py-2 text-sm bg-background outline-none focus:ring-2 focus:ring-ring"
              >
                <option value="">Select course</option>
                {courses.map((c: Course) => (
                  <option key={c.id} value={c.id}>
                    {c.name} (Y{c.year})
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                Section *
              </p>
              <select
                value={form.section_id}
                onChange={(e) =>
                  setForm({ ...form, section_id: e.target.value })
                }
                className="w-full border border-input rounded-lg px-3 py-2 text-sm bg-background outline-none focus:ring-2 focus:ring-ring"
              >
                <option value="">Select section</option>
                {filteredSections.map((s: Section) => (
                  <option key={s.id} value={s.id}>
                    Sec {s.name} · Y{s.year} · {s.programme_name}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                Teacher
              </p>
              <select
                value={form.teacher_id}
                onChange={(e) =>
                  setForm({ ...form, teacher_id: e.target.value })
                }
                className="w-full border border-input rounded-lg px-3 py-2 text-sm bg-background outline-none focus:ring-2 focus:ring-ring"
              >
                <option value="">Assign later</option>
                {teachers.map((t: User) => (
                  <option key={t.id} value={t.id}>
                    {t.full_name}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button
                onClick={handleAdd}
                disabled={saving}
                className="bg-primary hover:bg-primary/90"
              >
                {saving ? "Saving..." : "Add Offering"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Teacher Modal */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="font-display">Assign Teacher</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <p className="text-sm text-muted-foreground">
              {editing?.course_name} — Sec {editing?.section_name}
            </p>
            <div className="space-y-1.5">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                Teacher
              </p>
              <select
                value={editTeacher}
                onChange={(e) => setEditTeacher(e.target.value)}
                className="w-full border border-input rounded-lg px-3 py-2 text-sm bg-background outline-none focus:ring-2 focus:ring-ring"
              >
                <option value="">Unassigned</option>
                {teachers.map((t: User) => (
                  <option key={t.id} value={t.id}>
                    {t.full_name}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setEditOpen(false)}>
                Cancel
              </Button>
              <Button
                onClick={handleEditTeacher}
                disabled={saving}
                className="bg-primary hover:bg-primary/90"
              >
                {saving ? "Saving..." : "Save"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default SetupTab;
