import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Dimensions, Modal, TextInput, Linking } from 'react-native';
import { BarChart, PieChart } from 'react-native-chart-kit';
import { Wallet, CreditCard, Home, CheckCircle2, Circle, ChevronLeft, ChevronRight, PiggyBank, Plus, Paperclip, Upload } from 'lucide-react-native';
import { collection, onSnapshot, doc, updateDoc, addDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import * as ImagePicker from 'expo-image-picker';
import { db, storage } from '../config/firebase';

const formatMoney = (value) => {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
};

export default function FinancesScreen() {
  const [incomes, setIncomes] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [cards, setCards] = useState([]);
  const [piggyBank, setPiggyBank] = useState([]);
  const [currentDate, setCurrentDate] = useState(new Date(2026, 1, 1)); // Iniciando em Fevereiro 2026 para os mocks
  const [ownerFilter, setOwnerFilter] = useState('all'); // 'all', 'Dario', 'Esposa'
  const [uploading, setUploading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [newExpense, setNewExpense] = useState({ desc: '', value: '', category: 'contas', owner: 'Comum' });

  const currentMonthStr = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}`;
  
  const monthNames = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
  
  const prevMonth = () => setCurrentDate(new Date(currentDate.setMonth(currentDate.getMonth() - 1)));
  const nextMonth = () => setCurrentDate(new Date(currentDate.setMonth(currentDate.getMonth() + 1)));

  useEffect(() => {
    // Escutar receitas em tempo real
    const unsubscribeIncomes = onSnapshot(collection(db, 'incomes'), (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setIncomes(data);
    });

    // Escutar despesas em tempo real
    const unsubscribeExpenses = onSnapshot(collection(db, 'expenses'), (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setExpenses(data);
    });

    // Escutar cartões em tempo real
    const unsubscribeCards = onSnapshot(collection(db, 'cards'), (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setCards(data);
    });

    // Escutar cofrinho em tempo real
    const unsubscribePiggy = onSnapshot(collection(db, 'piggyBank'), (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setPiggyBank(data);
    });

    return () => {
      unsubscribeIncomes();
      unsubscribeExpenses();
      unsubscribeCards();
      unsubscribePiggy();
    };
  }, []);

  const togglePaidStatus = async (collectionName, item) => {
    try {
      const itemRef = doc(db, collectionName, item.id);
      await updateDoc(itemRef, { paid: !item.paid });
    } catch (error) {
      console.error("Erro ao atualizar status:", error);
    }
  };

  const toggleExpense = (item) => togglePaidStatus('expenses', item);
  const toggleCard = (item) => togglePaidStatus('cards', item);

  const addPiggyDeposit = async () => {
    // Exemplo de adição fixa (idealmente abriria um Modal para digitar o valor)
    try {
      await addDoc(collection(db, 'piggyBank'), {
        desc: 'Aporte Mensal',
        value: 100, // Valor fixo para teste
        date: currentMonthStr + '-01',
        owner: ownerFilter === 'all' ? 'Comum' : ownerFilter
      });
      alert("Aporte de R$ 100 adicionado ao Cofrinho!");
    } catch (error) {
      console.error("Erro ao adicionar cofrinho:", error);
    }
  };

  const handleAddExpense = async () => {
    if (!newExpense.desc || !newExpense.value) {
      alert("Preencha a descrição e o valor.");
      return;
    }
    
    try {
      await addDoc(collection(db, 'expenses'), {
        desc: newExpense.desc,
        value: parseFloat(newExpense.value.replace(',', '.')),
        category: newExpense.category,
        date: currentMonthStr + '-15', // Usando dia 15 padrão para o mês selecionado
        owner: newExpense.owner,
        paid: false
      });
      setModalVisible(false);
      setNewExpense({ desc: '', value: '', category: 'contas', owner: 'Comum' }); // Reset
    } catch (error) {
      console.error("Erro ao adicionar despesa:", error);
      alert("Falha ao salvar despesa.");
    }
  };

  const pickImage = async (collectionName, itemId) => {
    try {
      let result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        quality: 0.8,
      });

      if (!result.canceled) {
        setUploading(true);
        const imageUri = result.assets[0].uri;
        let blob;

        try {
          // Tentativa padrão (Funciona melhor em mobile)
          const response = await fetch(imageUri);
          blob = await response.blob();
        } catch (e) {
          // Fallback para Web (Fetch de blob: URI as vezes falha no XMLHttpRequest poli)
          console.log("Fallback de fetch para Blob");
          blob = await new Promise((resolve, reject) => {
            const xhr = new XMLHttpRequest();
            xhr.onload = function() { resolve(xhr.response); };
            xhr.onerror = function(e) { reject(new TypeError('Network request failed')); };
            xhr.responseType = 'blob';
            xhr.open('GET', imageUri, true);
            xhr.send(null);
          });
        }
        
        // Cria referência única no Storage
        const fileRef = ref(storage, `receipts/${itemId}_${Date.now()}`);
        
        // Faz o upload
        await uploadBytes(fileRef, blob);
        const downloadUrl = await getDownloadURL(fileRef);

        // Atualiza o documento no Firestore com a URL
        const itemRef = doc(db, collectionName, itemId);
        await updateDoc(itemRef, { receiptUrl: downloadUrl });
        
        alert("Comprovante anexado com sucesso!");
      }
    } catch (error) {
      console.error("Erro no upload do comprovante: ", error);
      alert("Falha ao enviar comprovante.");
    } finally {
      setUploading(false);
    }
  };

  // Filtros
  const filterByMonthAndOwner = (item) => {
    const isSameMonth = item.date && item.date.startsWith(currentMonthStr);
    const isSameOwner = ownerFilter === 'all' || item.owner === ownerFilter || item.owner === 'Comum';
    return isSameMonth && isSameOwner;
  };

  const filteredIncomes = incomes.filter(filterByMonthAndOwner);
  const filteredExpenses = expenses.filter(filterByMonthAndOwner);
  const filteredCards = cards.filter(filterByMonthAndOwner);

  // Cálculos do Resumo Geral (Total Ganho x Total Gasto)
  const totalIncome = filteredIncomes.reduce((acc, curr) => acc + curr.value, 0); 
  const totalExpenses = filteredExpenses.reduce((acc, curr) => acc + curr.value, 0) + 
                        filteredCards.reduce((acc, curr) => acc + curr.value, 0); 
  const balance = totalIncome - totalExpenses;

  // Cálculo do Cofrinho (Total Acumulado de Sempre)
  const totalPiggyBank = piggyBank.reduce((acc, curr) => acc + curr.value, 0);

  // --- DADOS PARA O GRÁFICO DE BARRAS (ANO TODO) ---
  // Calculando despesas de cada mês para o gráfico de barras
  const getMonthlyExpenses = () => {
    const monthlyTotals = Array(12).fill(0);
    const filterByOwnerOnly = (item) => ownerFilter === 'all' || item.owner === ownerFilter || item.owner === 'Comum';

    // Combinar despesas + cartões
    const allExpenses = [...expenses, ...cards].filter(filterByOwnerOnly);

    allExpenses.forEach(expense => {
      // Ex: date = '2026-02-15' -> month = 1 (Fevereiro, zero-indexed)
      if (expense.date) {
        const [, month, ] = expense.date.split('-'); 
        if (month) {
          const monthIndex = parseInt(month, 10) - 1;
          monthlyTotals[monthIndex] += expense.value;
        }
      }
    });

    return monthlyTotals;
  };

  const barChartData = {
    labels: ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun"], // Mostrar primeiros 6 meses para caber ou girar label
    datasets: [
      {
        data: getMonthlyExpenses().slice(0, 6).map(val => val > 0 ? val : 0) // Pegando o primeiro semestre para ex.
      }
    ]
  };

  // --- DADOS PARA O GRÁFICO DE PIZZA (DO MÊS ATUAL) ---
  const pieChartData = [
    {
      name: 'Contas',
      population: filteredExpenses.filter(e => e.category === 'contas').reduce((acc, curr) => acc + curr.value, 0),
      color: '#f97316',
      legendFontColor: '#94a3b8',
      legendFontSize: 13,
    },
    {
      name: 'Imóveis',
      population: filteredExpenses.filter(e => e.category === 'imoveis').reduce((acc, curr) => acc + curr.value, 0),
      color: '#3b82f6',
      legendFontColor: '#94a3b8',
      legendFontSize: 13,
    },
    {
      name: 'Cartões',
      population: filteredCards.reduce((acc, curr) => acc + curr.value, 0),
      color: '#a855f7',
      legendFontColor: '#94a3b8',
      legendFontSize: 13,
    }
  ].filter(item => item.population > 0);

  const renderItem = (item, onToggle, collectionName, icon) => (
    <View key={item.id} style={styles.listItemContainer}>
      <TouchableOpacity style={styles.listItem} onPress={() => onToggle(item)} activeOpacity={0.7}>
        <View style={styles.listLeft}>
          {item.paid ? <CheckCircle2 color="#3b82f6" size={24} /> : <Circle color="#94a3b8" size={24} />}
          <View style={styles.listTextContainer}>
            <Text style={[styles.itemDesc, item.paid && styles.itemDescPaid]}>
              {item.desc}
              {item.receiptUrl && <Paperclip color="#94a3b8" size={12} style={{marginLeft: 6}} />}
            </Text>
            <Text style={styles.itemValue}>{formatMoney(item.value)}</Text>
          </View>
        </View>
        <View style={styles.listRight}>
          {icon}
        </View>
      </TouchableOpacity>
      
      {/* Ações Extra (Upload Comprovante) */}
      <View style={styles.listActions}>
        {!item.receiptUrl ? (
          <TouchableOpacity 
            style={styles.actionBtn} 
            onPress={() => pickImage(collectionName, item.id)}
            disabled={uploading}
          >
            {uploading ? <ActivityIndicator size="small" color="#94a3b8" /> : <Upload color="#94a3b8" size={16} />}
            <Text style={styles.actionBtnText}>{uploading ? 'Enviando...' : 'Anexar Recibo'}</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity 
            style={styles.actionBtn} 
            onPress={() => Linking.openURL(item.receiptUrl)}
          >
            <Paperclip color="#3b82f6" size={16} />
            <Text style={[styles.actionBtnText, {color: '#3b82f6'}]}>Ver Recibo</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );

  return (
    <ScrollView style={styles.container}>
      
      {/* Seletor de Mês e Filtros */}
      <View style={styles.topControls}>
        <View style={styles.monthSelector}>
          <TouchableOpacity onPress={prevMonth} style={styles.monthButton}><ChevronLeft color="#f8fafc" /></TouchableOpacity>
          <Text style={styles.monthTitle}>{monthNames[currentDate.getMonth()]} {currentDate.getFullYear()}</Text>
          <TouchableOpacity onPress={nextMonth} style={styles.monthButton}><ChevronRight color="#f8fafc" /></TouchableOpacity>
        </View>
        <View style={styles.filterSelector}>
          {['all', 'Dario', 'Esposa'].map(filter => (
            <TouchableOpacity 
              key={filter} 
              style={[styles.filterBtn, ownerFilter === filter && styles.filterBtnActive]}
              onPress={() => setOwnerFilter(filter)}>
              <Text style={[styles.filterText, ownerFilter === filter && styles.filterTextActive]}>
                {filter === 'all' ? 'Geral' : filter}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Resumo do Mês */}
      <View style={styles.headerBox}>
        <Text style={styles.overviewTitle}>Visão Geral</Text>
        <View style={styles.balanceRow}>
          <View style={styles.balanceCol}>
             <Text style={styles.balanceLabel}>Total Ganho</Text>
             <Text style={styles.balanceValueIncome}>{formatMoney(totalIncome)}</Text>
          </View>
          <View style={styles.balanceCol}>
             <Text style={styles.balanceLabel}>Total Previsto</Text>
             <Text style={styles.balanceValueExpense}>{formatMoney(totalExpenses)}</Text>
          </View>
        </View>
        <View style={styles.divider} />
        <View style={styles.finalBalanceRow}>
           <Text style={styles.finalBalanceText}>Saldo Final Projetado</Text>
           <Text style={[styles.finalBalanceValue, balance < 0 ? {color: '#ef4444'} : {color: '#22c55e'}]}>
             {formatMoney(balance)}
           </Text>
        </View>

        {/* Gráfico de Barras (Despesas por Semestre/Ano) */}
        <Text style={styles.chartTitle}>Despesas (1º Semestre)</Text>
        <BarChart
          data={barChartData}
          width={Dimensions.get('window').width - 70}
          height={220}
          yAxisLabel="R$"
          chartConfig={{
            backgroundColor: '#1e293b',
            backgroundGradientFrom: '#1e293b',
            backgroundGradientTo: '#1e293b',
            decimalPlaces: 0,
            color: (opacity = 1) => `rgba(249, 115, 22, ${opacity})`,
            labelColor: (opacity = 1) => `rgba(148, 163, 184, ${opacity})`,
            style: { borderRadius: 16 },
          }}
          style={{ marginVertical: 8, borderRadius: 16 }}
          showValuesOnTopOfBars={true}
        />

        {/* Gráfico de Pizza (Categorias do Mês Atual) */}
        {pieChartData.length > 0 && (
          <View style={{ marginTop: 24, alignItems: 'center', borderTopWidth: 1, borderTopColor: '#334155', paddingTop: 16 }}>
            <Text style={styles.chartTitle}>Divisão do Mês</Text>
            <PieChart
              data={pieChartData}
              width={Dimensions.get('window').width - 70}
              height={180}
              chartConfig={{
                color: (opacity = 1) => `rgba(255, 255, 255, ${opacity})`,
              }}
              accessor={"population"}
              backgroundColor={"transparent"}
              paddingLeft={"15"}
              absolute
            />
          </View>
        )}
      </View>

      {/* Seção Cofrinho */}
      <View style={styles.piggyBox}>
        <View style={{flexDirection: 'row', alignItems: 'center', marginBottom: 12}}>
          <PiggyBank color="#fbbf24" size={28} style={{marginRight: 10}} />
          <View>
            <Text style={styles.piggyTitle}>Cofrinho Acumulado</Text>
            <Text style={styles.piggySubtitle}>Reserva para o Futuro</Text>
          </View>
        </View>
        
        <View style={styles.piggyBalanceRow}>
          <Text style={styles.piggyValue}>{formatMoney(totalPiggyBank)}</Text>
          <TouchableOpacity style={styles.piggyButton} onPress={addPiggyDeposit}>
            <Plus color="#1e293b" size={20} />
            <Text style={styles.piggyBtnText}>Guardar</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Lista de Contas da Casa / Pessoal */}
      <Text style={styles.sectionTitle}>Contas do Mês</Text>
      <View style={styles.listContainer}>
        {filteredExpenses.filter(e => e.category === 'contas').map(item => 
          renderItem(item, toggleExpense, 'expenses', <Wallet color="#64748b" size={20} />)
        )}
      </View>

      {/* Terrenos e Imóveis */}
      <Text style={styles.sectionTitle}>Imóveis & Consórcios</Text>
      <View style={styles.listContainer}>
        {filteredExpenses.filter(e => e.category === 'imoveis').map(item => 
          renderItem(item, toggleExpense, 'expenses', <Home color="#64748b" size={20} />)
        )}
      </View>

      {/* Cartões de Crédito */}
      <Text style={styles.sectionTitle}>Cartões de Crédito</Text>
      <View style={styles.listContainer}>
        {filteredCards.map(item => 
          renderItem(item, toggleCard, 'cards', <CreditCard color="#64748b" size={20} />)
        )}
      </View>

      {/* Botão Flutuante (FAB) para Adicionar Despesa */}
      <TouchableOpacity style={styles.fab} onPress={() => setModalVisible(true)}>
        <Plus color="#1e293b" size={30} />
      </TouchableOpacity>

      {/* Modal para Nova Despesa */}
      <Modal visible={modalVisible} transparent={true} animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Nova Despesa</Text>
            
            <TextInput 
              style={styles.input} 
              placeholder="Descrição (ex: Luz)" 
              placeholderTextColor="#94a3b8"
              value={newExpense.desc}
              onChangeText={(text) => setNewExpense({...newExpense, desc: text})}
            />
            
            <TextInput 
              style={styles.input} 
              placeholder="Valor (ex: 150.50)" 
              placeholderTextColor="#94a3b8"
              keyboardType="numeric"
              value={newExpense.value}
              onChangeText={(text) => setNewExpense({...newExpense, value: text})}
            />

            <View style={styles.modalButtonsRow}>
              {['contas', 'imoveis'].map(cat => (
                <TouchableOpacity 
                  key={cat}
                  style={[styles.modalCatBtn, newExpense.category === cat && styles.modalCatBtnActive]}
                  onPress={() => setNewExpense({...newExpense, category: cat})}
                >
                  <Text style={[styles.modalBtnText, newExpense.category === cat && {color: '#f8fafc'}]}>{cat === 'contas' ? 'Conta Mensal' : 'Imóvel/Consórcio'}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <View style={styles.modalButtonsRow}>
              {['Dario', 'Esposa', 'Comum'].map(owner => (
                <TouchableOpacity 
                  key={owner}
                  style={[styles.modalOwnerBtn, newExpense.owner === owner && styles.modalOwnerBtnActive]}
                  onPress={() => setNewExpense({...newExpense, owner: owner})}
                >
                  <Text style={[styles.modalBtnText, newExpense.owner === owner && {color: '#f8fafc'}]}>{owner}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <View style={{flexDirection: 'row', marginTop: 24, gap: 12}}>
              <TouchableOpacity style={[styles.saveBtn, {backgroundColor: '#334155'}]} onPress={() => setModalVisible(false)}>
                <Text style={styles.saveBtnText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.saveBtn} onPress={handleAddExpense}>
                <Text style={styles.saveBtnText}>Adicionar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f172a', padding: 16 },
  
  topControls: { marginBottom: 20 },
  monthSelector: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  monthButton: { padding: 8, backgroundColor: '#1e293b', borderRadius: 8 },
  monthTitle: { color: '#f8fafc', fontSize: 18, fontWeight: 'bold' },
  filterSelector: { flexDirection: 'row', justifyContent: 'space-between', backgroundColor: '#1e293b', borderRadius: 8, padding: 4 },
  filterBtn: { flex: 1, paddingVertical: 8, alignItems: 'center', borderRadius: 6 },
  filterBtnActive: { backgroundColor: '#f97316' },
  filterText: { color: '#94a3b8', fontWeight: 'bold' },
  filterTextActive: { color: '#f8fafc' },

  headerBox: {
    backgroundColor: '#1e293b',
    borderRadius: 16,
    padding: 20,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#334155'
  },
  overviewTitle: { color: '#94a3b8', fontSize: 14, fontWeight: '600', marginBottom: 16, textAlign: 'center', textTransform: 'uppercase' },
  chartTitle: { color: '#94a3b8', fontSize: 12, fontWeight: '600', marginBottom: 8, textAlign: 'center', textTransform: 'uppercase', letterSpacing: 1 },
  balanceRow: { flexDirection: 'row', justifyContent: 'space-between' },
  balanceCol: { alignItems: 'center' },
  balanceLabel: { color: '#94a3b8', fontSize: 13, marginBottom: 4 },
  balanceValueIncome: { color: '#3b82f6', fontSize: 20, fontWeight: 'bold' }, // Azul seguindo a planilha
  balanceValueExpense: { color: '#ef4444', fontSize: 20, fontWeight: 'bold' },
  
  piggyBox: {
    backgroundColor: '#1e293b',
    borderRadius: 16,
    padding: 20,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#fbbf24',
    borderStyle: 'dashed'
  },
  piggyTitle: { color: '#f8fafc', fontSize: 18, fontWeight: 'bold' },
  piggySubtitle: { color: '#94a3b8', fontSize: 13 },
  piggyBalanceRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 16 },
  piggyValue: { color: '#fbbf24', fontSize: 26, fontWeight: '900' },
  piggyButton: { backgroundColor: '#fbbf24', flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 10, borderRadius: 8 },
  piggyBtnText: { color: '#1e293b', fontWeight: 'bold', marginLeft: 6 },

  divider: { height: 1, backgroundColor: '#334155', marginVertical: 16 },
  
  finalBalanceRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  finalBalanceText: { color: '#f8fafc', fontSize: 15, fontWeight: '600' },
  finalBalanceValue: { fontSize: 22, fontWeight: '900' },

  sectionTitle: { color: '#f8fafc', fontSize: 18, fontWeight: 'bold', marginBottom: 12, marginLeft: 4 },
  listContainer: {
    backgroundColor: '#1e293b',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#334155',
    marginBottom: 24,
    overflow: 'hidden'
  },
  listItemContainer: {
    borderBottomWidth: 1,
    borderBottomColor: '#334155',
  },
  listItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
  },
  listLeft: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  listTextContainer: { marginLeft: 12, flex: 1 },
  itemDesc: { color: '#f8fafc', fontSize: 15, fontWeight: '500', marginBottom: 2, flexDirection: 'row', alignItems: 'center' },
  itemDescPaid: { color: '#94a3b8', textDecorationLine: 'line-through' },
  itemValue: { color: '#cbd5e1', fontSize: 14 },
  listRight: { paddingLeft: 10 },
  
  listActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 12,
    backgroundColor: '#0f172a',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#334155'
  },
  actionBtnText: {
    color: '#94a3b8',
    fontSize: 12,
    fontWeight: 'bold',
    marginLeft: 6
  },
  
  fab: {
    position: 'absolute',
    bottom: 24,
    right: 24,
    backgroundColor: '#f97316',
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    padding: 24,
  },
  modalContent: {
    backgroundColor: '#1e293b',
    borderRadius: 20,
    padding: 24,
    borderWidth: 1,
    borderColor: '#334155'
  },
  modalTitle: { color: '#f8fafc', fontSize: 20, fontWeight: 'bold', marginBottom: 20, textAlign: 'center' },
  input: {
    backgroundColor: '#0f172a',
    color: '#f8fafc',
    borderRadius: 10,
    padding: 16,
    marginBottom: 16,
    fontSize: 16,
    borderWidth: 1,
    borderColor: '#334155'
  },
  modalButtonsRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 16, gap: 8 },
  modalCatBtn: { flex: 1, padding: 12, borderRadius: 8, backgroundColor: '#0f172a', alignItems: 'center', borderWidth: 1, borderColor: '#334155' },
  modalCatBtnActive: { backgroundColor: '#3b82f6', borderColor: '#3b82f6' },
  modalOwnerBtn: { flex: 1, padding: 12, borderRadius: 8, backgroundColor: '#0f172a', alignItems: 'center', borderWidth: 1, borderColor: '#334155' },
  modalOwnerBtnActive: { backgroundColor: '#a855f7', borderColor: '#a855f7' },
  modalBtnText: { color: '#94a3b8', fontSize: 13, fontWeight: 'bold' },
  saveBtn: { flex: 1, backgroundColor: '#f97316', padding: 16, borderRadius: 10, alignItems: 'center' },
  saveBtnText: { color: '#1e293b', fontSize: 16, fontWeight: 'bold' }
});
