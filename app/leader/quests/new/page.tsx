import { QuestForm } from "../quest-form";

export default function NewQuestPage() {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-sm flex-col gap-6 px-6 py-8">
      <h1 className="text-xl font-semibold">New quest</h1>
      <QuestForm mode="create" />
    </main>
  );
}
