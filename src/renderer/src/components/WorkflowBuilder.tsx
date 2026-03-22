import { useState } from 'react';
import { v4 as uuid } from 'uuid';

import type { AgentId, AgentRole, CustomWorkflow, CustomWorkflowStep, WorkflowMode } from '@shared/types';

interface WorkflowBuilderProps {
  onClose: () => void;
  onSave: (workflow: CustomWorkflow) => void;
  editWorkflow?: CustomWorkflow;
}

const AGENT_IDS: AgentId[] = ['claude', 'codex', 'gemini', 'ollama'];
const AGENT_ROLES: AgentRole[] = ['coder', 'reviewer', 'tester', 'architect', 'planner', 'monitor'];
const WORKFLOW_MODES: WorkflowMode[] = ['chain', 'orchestrate', 'parallel', 'direct'];

function makeStep(): CustomWorkflowStep {
  return {
    id: uuid(),
    agentId: 'claude',
    role: 'coder',
    promptTemplate: '{{brief}}',
    requiresApproval: false
  };
}

export function WorkflowBuilder({ onClose, onSave, editWorkflow }: WorkflowBuilderProps) {
  const [label, setLabel] = useState(editWorkflow?.label ?? '');
  const [description, setDescription] = useState(editWorkflow?.description ?? '');
  const [mode, setMode] = useState<WorkflowMode>(editWorkflow?.mode ?? 'chain');
  const [steps, setSteps] = useState<CustomWorkflowStep[]>(
    editWorkflow?.steps.length ? editWorkflow.steps : [makeStep()]
  );
  const [validationError, setValidationError] = useState<string | undefined>();

  function addStep() {
    setSteps((prev) => [...prev, makeStep()]);
  }

  function removeStep(index: number) {
    setSteps((prev) => prev.filter((_, i) => i !== index));
  }

  function moveStepUp(index: number) {
    if (index === 0) return;
    setSteps((prev) => {
      const next = [...prev];
      [next[index - 1], next[index]] = [next[index], next[index - 1]];
      return next;
    });
  }

  function moveStepDown(index: number) {
    setSteps((prev) => {
      if (index >= prev.length - 1) return prev;
      const next = [...prev];
      [next[index], next[index + 1]] = [next[index + 1], next[index]];
      return next;
    });
  }

  function updateStep(index: number, patch: Partial<CustomWorkflowStep>) {
    setSteps((prev) => prev.map((step, i) => (i === index ? { ...step, ...patch } : step)));
  }

  function handleSave() {
    if (!label.trim()) {
      setValidationError('Workflow name is required.');
      return;
    }
    if (steps.length === 0) {
      setValidationError('Add at least one step.');
      return;
    }
    for (const step of steps) {
      if (!step.promptTemplate.trim()) {
        setValidationError('All steps must have a prompt template.');
        return;
      }
    }

    const now = new Date().toISOString();
    const workflow: CustomWorkflow = {
      id: editWorkflow?.id ?? uuid(),
      label: label.trim(),
      description: description.trim(),
      mode,
      stages: [],
      steps,
      isCustom: true,
      createdAt: editWorkflow?.createdAt ?? now,
      updatedAt: now
    };
    onSave(workflow);
  }

  return (
    <div className="workflow-builder-overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="workflow-builder-panel">
        <div className="workflow-builder-header">
          <h2>{editWorkflow ? 'Edit Workflow' : 'New Workflow'}</h2>
          <button className="workflow-builder-close" onClick={onClose}>x</button>
        </div>

        <div className="workflow-builder-body">
          {validationError && <p className="error-banner">{validationError}</p>}

          <label className="field-label">
            Name
            <input
              type="text"
              value={label}
              onChange={(e) => { setLabel(e.target.value); setValidationError(undefined); }}
              placeholder="My workflow"
            />
          </label>

          <label className="field-label">
            Description
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Optional description"
            />
          </label>

          <label className="field-label">
            Mode
            <select value={mode} onChange={(e) => setMode(e.target.value as WorkflowMode)}>
              {WORKFLOW_MODES.map((m) => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
          </label>

          <div className="step-list">
            <div className="step-list-header">
              <strong>Steps</strong>
              <button onClick={addStep}>+ Add step</button>
            </div>

            {steps.map((step, index) => (
              <div key={step.id} className="step-card">
                <div className="step-card-controls">
                  <span className="step-number">{index + 1}</span>
                  <button disabled={index === 0} onClick={() => moveStepUp(index)}>up</button>
                  <button disabled={index === steps.length - 1} onClick={() => moveStepDown(index)}>dn</button>
                  <button onClick={() => removeStep(index)}>del</button>
                </div>

                <div className="step-card-fields">
                  <label className="field-label">
                    Agent
                    <select
                      value={step.agentId}
                      onChange={(e) => updateStep(index, { agentId: e.target.value as AgentId })}
                    >
                      {AGENT_IDS.map((id) => (
                        <option key={id} value={id}>{id}</option>
                      ))}
                    </select>
                  </label>

                  <label className="field-label">
                    Role
                    <select
                      value={step.role}
                      onChange={(e) => updateStep(index, { role: e.target.value as AgentRole })}
                    >
                      {AGENT_ROLES.map((r) => (
                        <option key={r} value={r}>{r}</option>
                      ))}
                    </select>
                  </label>

                  <label className="field-label">
                    Prompt template
                    <textarea
                      value={step.promptTemplate}
                      onChange={(e) => updateStep(index, { promptTemplate: e.target.value })}
                      rows={4}
                      placeholder="Use {{brief}} to include the task brief."
                    />
                  </label>

                  <label className="toggle-row">
                    <input
                      type="checkbox"
                      checked={step.requiresApproval}
                      onChange={(e) => updateStep(index, { requiresApproval: e.target.checked })}
                    />
                    <span>Require approval before next step</span>
                  </label>
                </div>
              </div>
            ))}

            {steps.length === 0 && (
              <p className="empty-state">No steps yet. Click "+ Add step" to begin.</p>
            )}
          </div>
        </div>

        <div className="workflow-builder-footer">
          <button onClick={onClose}>Cancel</button>
          <button onClick={handleSave}>Save workflow</button>
        </div>
      </div>
    </div>
  );
}
