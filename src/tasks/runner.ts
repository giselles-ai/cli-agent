import crypto from "node:crypto";

export type TaskStatus =
	| "queued"
	| "running"
	| "completed"
	| "failed"
	| "cancelled";

export type TaskInfo = {
	id: string;
	name: string;
	status: TaskStatus;
	createdAt: number;
	durationMs: number;
	startedAt?: number;
	endedAt?: number;
	result?: string;
	error?: string;
};

type RunningState = {
	controller: AbortController;
	timer: NodeJS.Timeout;
};

export type TaskEventHandler = (task: TaskInfo, status: TaskStatus) => void;

export class TaskRunner {
	constructor(private onEvent?: TaskEventHandler) {}

	private tasks = new Map<string, TaskInfo>();
	private queue: string[] = [];
	private running: string | null = null;
	private runningState = new Map<string, RunningState>();

	enqueue(name: string, durationMs = 1000): TaskInfo {
		const id = crypto.randomUUID();
		const info: TaskInfo = {
			id,
			name,
			status: "queued",
			createdAt: Date.now(),
			durationMs,
		};
		this.tasks.set(id, info);
		this.queue.push(id);
		this.onEvent?.(info, "queued");
		void this.runNext();
		return info;
	}

	list(): TaskInfo[] {
		return Array.from(this.tasks.values());
	}

	get(taskId: string): TaskInfo | undefined {
		return this.tasks.get(taskId);
	}

	cancel(taskId: string): TaskInfo | undefined {
		const task = this.tasks.get(taskId);
		if (!task) return undefined;

		if (task.status === "queued") {
			this.queue = this.queue.filter((id) => id !== taskId);
			task.status = "cancelled";
			task.endedAt = Date.now();
			this.onEvent?.(task, "cancelled");
			return task;
		}

		if (task.status === "running") {
			const running = this.runningState.get(taskId);
			running?.controller.abort();
			return task;
		}

		return task;
	}

	private async runNext(): Promise<void> {
		if (this.running || this.queue.length === 0) return;

		const nextId = this.queue.shift();
		if (!nextId) return;

		const task = this.tasks.get(nextId);
		if (!task) return;

		task.status = "running";
		task.startedAt = Date.now();
		this.onEvent?.(task, "running");
		this.running = nextId;

		const controller = new AbortController();

		const done = new Promise<void>((resolve, reject) => {
			const timer = setTimeout(() => resolve(), task.durationMs);
			this.runningState.set(nextId, { controller, timer });

			controller.signal.addEventListener("abort", () => {
				clearTimeout(timer);
				reject(new Error("cancelled"));
			});
		});

		try {
			await done;
			task.status = "completed";
			task.result = "ok";
			this.onEvent?.(task, "completed");
		} catch (err) {
			task.status = "cancelled";
			task.error = err instanceof Error ? err.message : "cancelled";
			this.onEvent?.(task, "cancelled");
		} finally {
			task.endedAt = Date.now();
			this.runningState.delete(nextId);
			this.running = null;
			if (this.queue.length > 0) {
				void this.runNext();
			}
		}
	}
}
