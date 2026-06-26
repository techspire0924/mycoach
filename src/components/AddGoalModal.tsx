import { useState } from "react";
import { useStore } from "../store";

interface Props {
  onClose: () => void;
  defaultParentId?: string;
}

export default function AddGoalModal({ onClose, defaultParentId }: Props) {
  const { addGoal, goals } = useStore();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [targetDate, setTargetDate] = useState("");
  const [parentGoalId, setParentGoalId] = useState(defaultParentId ?? "");

  async function handleSave() {
    if (!title.trim()) return;
    await addGoal({
      title: title.trim(),
      description: description.trim() || undefined,
      target_date: targetDate || undefined,
      parent_goal_id: parentGoalId || undefined,
    });
    onClose();
  }

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <h3>Add Goal</h3>
        <input
          className="modal-input"
          placeholder="Goal title..."
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          autoFocus
        />
        <textarea
          className="modal-input"
          placeholder="Description (optional)..."
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={2}
          style={{ resize: "vertical" }}
        />
        <select className="modal-select" value={parentGoalId} onChange={(e) => setParentGoalId(e.target.value)}>
          <option value="">No parent goal</option>
          {goals.map((g) => (
            <option key={g.id} value={g.id}>{g.title}</option>
          ))}
        </select>
        <input
          className="modal-input"
          type="date"
          value={targetDate}
          onChange={(e) => setTargetDate(e.target.value)}
          placeholder="Target date"
        />
        <div className="modal-actions">
          <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={handleSave}>Add Goal</button>
        </div>
      </div>
    </div>
  );
}
