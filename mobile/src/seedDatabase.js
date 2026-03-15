import { collection, addDoc, getDocs } from 'firebase/firestore';
import { db } from './config/firebase';

const mockIncomes = [
  { desc: 'Salário final Jabil', value: 4494.00, paid: true, date: '2026-02-05', owner: 'Dario' },
  { desc: 'Salário final FMM', value: 3348.00, paid: true, date: '2026-02-05', owner: 'Esposa' },
  { desc: 'AFEAM 03', value: 3381.00, paid: false, date: '2026-02-10', owner: 'Comum' },
];

const mockExpenses = [
  { desc: 'Consorcio 15', value: 1299.00, category: 'imoveis', paid: true, date: '2026-02-15', owner: 'Comum' },
  { desc: 'Terreno 20', value: 518.00, category: 'imoveis', paid: false, date: '2026-02-20', owner: 'Dario' },
  { desc: 'Juros da obra 17', value: 1800.00, category: 'imoveis', paid: true, date: '2026-02-17', owner: 'Comum' },
  { desc: 'Plano celular', value: 65.00, category: 'contas', paid: true, date: '2026-02-10', owner: 'Esposa' },
  { desc: 'Contas casa', value: 550.00, category: 'contas', paid: false, date: '2026-02-15', owner: 'Comum' },
  { desc: 'Energia mamae 01', value: 250.00, category: 'contas', paid: true, date: '2026-02-01', owner: 'Dario' },
  { desc: 'Barbeiro', value: 105.00, category: 'contas', paid: true, date: '2026-02-08', owner: 'Dario' },
  { desc: 'Entrada Apartamento 29', value: 575.00, category: 'imoveis', paid: true, date: '2026-02-28', owner: 'Comum' },
  { desc: 'Entrada Apartamento 10', value: 629.00, category: 'imoveis', paid: true, date: '2026-02-10', owner: 'Comum' },
  { desc: 'ITBI Apartamento 10', value: 223.00, category: 'imoveis', paid: true, date: '2026-02-10', owner: 'Comum' },
  { desc: 'Financiamento 12', value: 1025.00, category: 'imoveis', paid: true, date: '2026-02-12', owner: 'Comum' },
];

const mockCards = [
  { desc: 'Itaú Black 30 (Oficina)', value: 1889.00, paid: true, date: '2026-02-28', owner: 'Dario' },
  { desc: 'Itaú azul 30 (Pessoal)', value: 2023.00, paid: true, date: '2026-02-28', owner: 'Dario' },
  { desc: 'Itaú internacional 16', value: 207.00, paid: true, date: '2026-02-16', owner: 'Comum' },
];

export const seedDatabase = async () => {
  try {
    console.log('Verificando se o banco já tem dados...');
    
    // Check if data already exists to prevent duplicate seeding
    const incomesSnapshot = await getDocs(collection(db, 'incomes'));
    if (!incomesSnapshot.empty) {
      console.log('Banco de dados já contém informações. Pulando Seed.');
      return;
    }

    console.log('Iniciando inclusão de Incomes...');
    for (const item of mockIncomes) {
      await addDoc(collection(db, 'incomes'), item);
    }

    console.log('Iniciando inclusão de Expenses...');
    for (const item of mockExpenses) {
      await addDoc(collection(db, 'expenses'), item);
    }
    
    console.log('Iniciando inclusão de Cards...');
    for (const item of mockCards) {
      await addDoc(collection(db, 'cards'), item);
    }

    console.log('Dados iniciais carregados com sucesso no Firebase!');
  } catch (error) {
    console.error('Erro ao carregar dados iniciais: ', error);
  }
};
