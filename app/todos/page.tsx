import Link from 'next/link';
import { cookies } from 'next/headers';
import { createClient } from '@/utils/supabase/server';

export const metadata = { title: 'Todos · Mary’s Cat Café' };

export default async function Page() {
  const supabase = createClient(await cookies());
  const { data: todos, error } = await supabase.from('todos').select('id, name');

  return (
    <main className="section">
      <p className="eyebrow">SUPABASE</p>
      <h1>Todos</h1>
      {error ? <p role="alert">Could not load todos. Check that the todos table exists and your Supabase policies allow reading it.</p>
        : todos?.length ? <ul>{todos.map((todo) => <li key={todo.id}>{todo.name}</li>)}</ul>
        : <p>No todos to show.</p>}
      <Link href="/">Back to the café</Link>
    </main>
  );
}
