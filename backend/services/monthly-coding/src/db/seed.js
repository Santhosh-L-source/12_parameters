require('dotenv').config();
const supabase = require('./index');

const STUDENTS = [
  { name: 'Aarav Sharma',  roll_number: 'MCA2024001' },
  { name: 'Priya Nair',    roll_number: 'MCA2024002' },
  { name: 'Rohit Verma',   roll_number: 'MCA2024003' },
];

(async () => {
  const { data, error } = await supabase
    .from('students')
    .upsert(STUDENTS, { onConflict: 'roll_number' })
    .select();

  if (error) { console.error('Seed failed:', error.message); process.exit(1); }
  console.log('Seeded students:', data.map(s => `${s.name} (${s.roll_number})`).join(', '));
  process.exit(0);
})();
