/**
 * Runs summarize_context on a longer synthetic conversation and measures
 * the token reduction from condensing older turns into a summary while
 * keeping the most recent exchange verbatim.
 */
import { summarizeContext, countMessages } from "../dist/index.js";

const messages = [
  { role: "user", content: "I'm building a REST API for a task management app. Can you help me design the database schema? It is important to note that we need users, projects, and tasks, with tasks belonging to projects and projects belonging to users." },
  { role: "assistant", content: "Sure! In order to design this schema, due to the fact that you have a clear hierarchy, I'd suggest three tables: users (id, email, password_hash, created_at), projects (id, user_id, name, created_at), and tasks (id, project_id, title, status, due_date, created_at). Please be advised that you should add foreign key constraints from projects.user_id to users.id and tasks.project_id to projects.id." },
  { role: "user", content: "That makes sense. What about adding tags to tasks? Some tasks might have multiple tags like 'urgent' or 'bug'." },
  { role: "assistant", content: "For a many-to-many relationship like tags, it is important to note that you should add a tags table (id, name) and a join table task_tags (task_id, tag_id) with a composite primary key. As previously mentioned, this keeps the schema normalized and avoids duplicating tag names across tasks." },
  { role: "user", content: "Got it. Now, due to the fact that we'll have a lot of tasks, how should I paginate the API responses for listing tasks in a project?" },
  { role: "assistant", content: "For pagination, in order to keep things efficient at scale, I'd recommend cursor-based pagination using the task's id or created_at as the cursor, rather than offset-based pagination which gets slow on large tables. Please be advised that you should also let clients pass a 'limit' query parameter capped at a sane maximum like 100." },
  { role: "user", content: "One more thing - what about filtering tasks by status and tags at the same time?" },
  { role: "assistant", content: "You can support combined filtering by accepting 'status' and 'tags' as query parameters, then building the SQL WHERE clause dynamically. For the tags filter, in order to match tasks that have ALL the specified tags, you'd join task_tags and group by task id with a HAVING COUNT(DISTINCT tag_id) = number of tags requested." },
  { role: "user", content: "Perfect, that all makes sense. Now let's switch topics - can you write the Express route handler for creating a new task, including validation?" },
];

const before = countMessages(messages);
const result = summarizeContext(messages, 400);
const after = countMessages(result.summarizedMessages);

console.log("Conversation-summary benchmark");
console.log("================================");
console.log(`Messages: ${messages.length} -> ${result.summarizedMessages.length}`);
console.log(`Tokens:   ${before} -> ${after}`);
console.log(`Saved:    ${result.tokensSaved} tokens (${(100 * result.tokensSaved / before).toFixed(1)}%)\n`);

result.summarizedMessages.forEach(m => {
  console.log(`[${m.role}] ${m.content.slice(0, 200)}${m.content.length > 200 ? "..." : ""}`);
});
