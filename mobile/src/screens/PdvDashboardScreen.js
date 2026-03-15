import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl, ActivityIndicator, TouchableOpacity } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { TrendingUp, Banknote, PackageOpen, PackageCheck, ShoppingBag, ArrowRight, BarChart3, PieChart as PieIcon } from 'lucide-react-native';
import { BarChart } from 'react-native-chart-kit';
import { Dimensions } from 'react-native';

// Usaremos a mesma URL gerada no Apps Script para ler vendas e estoque do PDV web
const SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbwANXc_RuodKauJiVUB2v2gHMvvRwT5p8_l-rg4sx8hectCR5gnGLvWRWzZ2c6QiBSSAQ/exec';

const formatMoney = (value) => {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
};

export default function PdvDashboardScreen() {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    productsCount: 0,
    outOfStock: 0,
    faturamentoHoje: 0,
    vendasHoje: 0,
    ticketMedio: 0,
    faturamentoMes: 0,
    lucroHoje: 0,
    lucroMes: 0,
    recentSales: [],
    monthlyData: [0, 0, 0, 0, 0, 0]
  });

  const loadDashboardData = async () => {
    setLoading(true);
    try {
      // 1. Buscar Produtos para o inventário
      const resP = await fetch(`${SCRIPT_URL}?action=getProducts`);
      const allProducts = await resP.json();
      const outOfStockItems = allProducts.filter(p => p.stock <= 0).length;

      // 2. Buscar vendas
      let dailyTotal = 0;
      let dailyProfit = 0;
      let dailyCount = 0;
      let monthlyProfit = 0;
      let recent = [];
      let allSales = [];

      try {
        const resV = await fetch(`${SCRIPT_URL}?action=getSales`);
        allSales = await resV.json();
        
        const hojeStr = new Date().toLocaleDateString('pt-BR');
        const salesToday = allSales.filter(sale => sale.date === hojeStr || sale.date?.includes(hojeStr));
        
        dailyTotal = salesToday.reduce((acc, s) => acc + (parseFloat(s.total) || 0), 0);
        dailyProfit = salesToday.reduce((acc, s) => acc + (parseFloat(s.profit) || 0), 0);
        dailyCount = salesToday.length;
        recent = allSales.slice(0, 5);

        const currentMonthStr = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`;
        const salesMonth = allSales.filter(s => s.date && s.date.includes(currentMonthStr));
        monthlyProfit = salesMonth.reduce((acc, s) => acc + (parseFloat(s.profit) || 0), 0);

      } catch (errApi) {
        console.error('Erro ao ler vendas do Apps Script:', errApi);
      }

      setStats({
        productsCount: allProducts.length,
        outOfStock: outOfStockItems,
        faturamentoHoje: dailyTotal,
        lucroHoje: dailyProfit,
        vendasHoje: dailyCount,
        ticketMedio: dailyCount > 0 ? dailyTotal / dailyCount : 0,
        faturamentoMes: allSales.filter(s => s.date && s.date.includes(`${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`)).reduce((acc, s) => acc + (parseFloat(s.total) || 0), 0),
        lucroMes: monthlyProfit,
        recentSales: recent,
        monthlyData: calculateMonthlyData(allSales)
      });

    } catch (e) {
      console.error('Falha crítica ao carregar Dashboard do PDV:', e);
    }
    setLoading(false);
  };

  
  const calculateMonthlyData = (allSales) => {
    const monthlyTotals = Array(6).fill(0);
    const now = new Date();
    
    for (let i = 0; i < 6; i++) {
        const d = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1);
        const monthStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        
        const monthSales = allSales.filter(s => s.date && s.date.includes(monthStr));
        monthlyTotals[i] = monthSales.reduce((acc, s) => acc + (parseFloat(s.total) || 0), 0);
    }
    return monthlyTotals;
  };

  const chartConfig = {
    backgroundColor: '#1e293b',
    backgroundGradientFrom: '#1e293b',
    backgroundGradientTo: '#1e293b',
    decimalPlaces: 0,
    color: (opacity = 1) => `rgba(249, 115, 22, ${opacity})`,
    labelColor: (opacity = 1) => `rgba(148, 163, 184, ${opacity})`,
    style: { borderRadius: 16 },
    propsForDots: { r: "6", strokeWidth: "2", stroke: "#f97316" }
  };

  useFocusEffect(
    useCallback(() => {
      loadDashboardData();
    }, [])
  );

  return (
    <ScrollView 
      style={styles.container}
      refreshControl={<RefreshControl refreshing={loading} onRefresh={loadDashboardData} tintColor="#f97316" />}
    >
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Dashboard PDV</Text>
        <Text style={styles.headerSubtitle}>Monitoramento em tempo real</Text>
      </View>

      {/* Cards de Faturamento e Lucro */}
      <View style={styles.cardsRow}>
        <View style={[styles.mainCard, { flex: 1, marginBottom: 0, borderColor: '#f9731633', backgroundColor: '#1e293b' }]}>
          <View style={styles.mainCardHeader}>
            <TrendingUp size={20} color="#f97316" />
            <Text style={styles.mainCardLabel}>Faturamento (Hoje)</Text>
          </View>
          <Text style={[styles.mainCardValue, { fontSize: 24 }]}>{formatMoney(stats.faturamentoHoje)}</Text>
          <Text style={styles.footerText}>{stats.vendasHoje} vendas</Text>
        </View>

        <View style={[styles.mainCard, { flex: 1, marginBottom: 0, borderColor: '#22c55e33', backgroundColor: '#1e293b' }]}>
          <View style={styles.mainCardHeader}>
            <Banknote size={20} color="#22c55e" />
            <Text style={styles.mainCardLabel}>Lucro (Hoje)</Text>
          </View>
          <Text style={[styles.mainCardValue, { fontSize: 24, color: '#22c55e' }]}>{formatMoney(stats.lucroHoje)}</Text>
          <View style={styles.badge}>
            <Text style={styles.badgeText}>Margem: {stats.faturamentoHoje > 0 ? ((stats.lucroHoje/stats.faturamentoHoje)*100).toFixed(1) : 0}%</Text>
          </View>
        </View>
      </View>

      <View style={[styles.cardsRow, { marginTop: 12 }]}>
        <View style={styles.smallCard}>
          <PackageCheck size={20} color="#3b82f6" style={styles.cardIcon} />
          <Text style={styles.smallCardLabel}>Produtos</Text>
          <Text style={styles.smallCardValue}>{stats.productsCount}</Text>
        </View>

        <View style={styles.smallCard}>
          <PackageOpen size={20} color="#ef4444" style={styles.cardIcon} />
          <Text style={styles.smallCardLabel}>Sem Estoque</Text>
          <Text style={[styles.smallCardValue, { color: stats.outOfStock > 0 ? '#ef4444' : '#f8fafc'}]}>{stats.outOfStock}</Text>
        </View>
      </View>

      <View style={styles.cardsRow}>
        <View style={[styles.smallCard, { borderColor: '#22c55e33' }]}>
          <TrendingUp size={20} color="#22c55e" style={styles.cardIcon} />
          <Text style={styles.smallCardLabel}>Lucro (Mês)</Text>
          <Text style={[styles.smallCardValue, { color: '#22c55e' }]}>{formatMoney(stats.lucroMes)}</Text>
        </View>

        <View style={styles.smallCard}>
          <PieIcon size={20} color="#a855f7" style={styles.cardIcon} />
          <Text style={styles.smallCardLabel}>Ticket Médio</Text>
          <Text style={styles.smallCardValue}>{formatMoney(stats.ticketMedio)}</Text>
        </View>
      </View>

      <View style={styles.section}>
        <View style={styles.sectionHeader}>
            <View style={{flexDirection: 'row', alignItems: 'center', gap: 8}}>
                <BarChart3 size={20} color="#f97316" />
                <Text style={styles.sectionTitle}>Desempenho (6 Meses)</Text>
            </View>
        </View>
        <View style={styles.chartContainer}>
            <BarChart
                data={{
                    labels: ["5m", "4m", "3m", "2m", "1m", "Atual"],
                    datasets: [{ data: stats.monthlyData }]
                }}
                width={Dimensions.get('window').width - 32}
                height={200}
                yAxisLabel="R$"
                chartConfig={chartConfig}
                style={{ marginVertical: 8, borderRadius: 16 }}
                fromZero
                showValuesOnTopOfBars
            />
        </View>
      </View>

      <View style={styles.section}>
         <View style={styles.sectionHeader}>
           <Text style={styles.sectionTitle}>Vendas Recentes</Text>
           <TouchableOpacity>
             <Text style={styles.seeMore}>Ver tudo</Text>
           </TouchableOpacity>
         </View>
         
         {stats.recentSales.length > 0 ? (
           stats.recentSales.map((sale, index) => (
             <View key={index} style={styles.saleItem}>
               <View style={styles.saleIcon}>
                 <ShoppingBag size={18} color="#f97316" />
               </View>
               <View style={styles.saleInfo}>
                 <Text style={styles.saleDesc} numberOfLines={1}>{sale.itemsResume || 'Venda sem itens'}</Text>
                 <Text style={styles.saleDate}>{sale.date} • {sale.paymentMethod || 'Outros'}</Text>
               </View>
               <Text style={styles.saleValue}>{formatMoney(sale.total)}</Text>
             </View>
           ))
         ) : (
           <View style={styles.emptyBox}>
              <Text style={{color: '#94a3b8', fontSize: 13, textAlign: 'center'}}>Aguardando novas vendas ou sincronizando com a planilha...</Text>
           </View>
         )}
      </View>
      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f172a', padding: 16 },
  header: { marginBottom: 20, marginTop: 10 },
  headerTitle: { fontSize: 26, fontWeight: 'bold', color: '#f8fafc' },
  headerSubtitle: { fontSize: 14, color: '#94a3b8', marginTop: 4 },
  
  mainCard: {
    borderRadius: 16, padding: 20, marginBottom: 16,
    borderWidth: 1, elevation: 4, shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8
  },
  mainCardHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  mainCardLabel: { fontSize: 14, color: '#94a3b8', fontWeight: '600' },
  mainCardValue: { fontSize: 32, fontWeight: '800', color: '#f8fafc', marginBottom: 12 },
  mainCardFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  footerText: { fontSize: 13, color: '#94a3b8' },
  badge: { backgroundColor: '#f9731622', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  badgeText: { color: '#f97316', fontSize: 12, fontWeight: 'bold' },

  cardsRow: { flexDirection: 'row', gap: 12, marginBottom: 24 },
  smallCard: {
    flex: 1, backgroundColor: '#1e293b',
    borderRadius: 12, padding: 16,
    borderWidth: 1, borderColor: '#334155'
  },
  cardIcon: { marginBottom: 8 },
  smallCardLabel: { fontSize: 12, color: '#94a3b8', marginBottom: 4 },
  smallCardValue: { fontSize: 18, fontWeight: 'bold', color: '#f8fafc' },

  section: { marginTop: 8 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  sectionTitle: { fontSize: 18, fontWeight: 'bold', color: '#f8fafc' },
  seeMore: { color: '#f97316', fontSize: 14, fontWeight: '600' },
  
  emptyBox: { 
    padding: 30, backgroundColor: '#1e293b', 
    borderRadius: 12, borderWidth: 1, 
    borderColor: '#334155', borderStyle: 'dashed' 
  },

  saleItem: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#1e293b',
    padding: 12, borderRadius: 12, marginBottom: 10,
    borderWidth: 1, borderColor: '#334155'
  },
  saleIcon: {
    width: 40, height: 40, borderRadius: 8, backgroundColor: '#f9731611',
    alignItems: 'center', justifyContent: 'center', marginRight: 12
  },
  saleInfo: { flex: 1 },
  saleDesc: { fontSize: 15, fontWeight: '600', color: '#f8fafc', marginBottom: 2 },
  saleDate: { fontSize: 12, color: '#94a3b8' },
  saleValue: { fontSize: 16, fontWeight: 'bold', color: '#f8fafc' }
});

