import { useState, useMemo, useRef, useEffect } from 'react';
import { ShoppingCart, Search, RefreshCw, Package, Maximize, Users, Settings, LogOut, PlusCircle, Minus, Plus, Trash2, CheckCircle2, X, Printer, CreditCard, Banknote, Smartphone, UserPlus, TrendingUp, History, UserCheck } from 'lucide-react';
import html2pdf from 'html2pdf.js';
import './index.css';

const SCRIPT_URL = import.meta.env.VITE_SCRIPT_URL || '/api';

function App() {
  const [products, setProducts] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [fetchError, setFetchError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [cart, setCart] = useState([]);
  const [currentUser, setCurrentUser] = useState(JSON.parse(localStorage.getItem('blitz_user')) || null);
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const MASTER_PASSWORD = '123'; // Senha mestra temporária

  // Controle de Checkout
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
  const [payments, setPayments] = useState([]); // Lista de pagamentos: {method, amount, customerName}
  const [currentMethod, setCurrentMethod] = useState('pix');
  const [currentAmountText, setCurrentAmountText] = useState('');

  // Campos Fiado
  const [fiadoName, setFiadoName] = useState('');
  const [fiadoDoc, setFiadoDoc] = useState('');

  // Modais de Gerenciamento
  const [isProductsModalOpen, setIsProductsModalOpen] = useState(false);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const [isUsersModalOpen, setIsUsersModalOpen] = useState(false);
  const [isSalesModalOpen, setIsSalesModalOpen] = useState(false);
  const [activeModalTab, setActiveModalTab] = useState('history'); // 'history' ou 'stats'
  const [historyPeriod, setHistoryPeriod] = useState('day'); // 'day', 'week', 'month', 'year'
  
  const [editingProduct, setEditingProduct] = useState(null);
  const [editingUser, setEditingUser] = useState(null);
  const [users, setUsers] = useState([]);
  const [salesHistory, setSalesHistory] = useState([]);
  
  const [settings, setSettings] = useState({
    businessName: 'BLITZ',
    cnpj: '00.000.000/0001-00',
    address: 'Rua Exemplo, 123 - Centro',
    phone: '(00) 00000-0000'
  });

  const receiptRef = useRef(null);

  // Api Calls
  const fetchProducts = async () => {
    setIsLoading(true);
    setFetchError(null);
    try {
      const response = await fetch(`${SCRIPT_URL}?action=getProducts`, {
        method: 'GET',
        redirect: 'follow'
      });
      
      if (!response.ok) {
        throw new Error(`Erro HTTP: ${response.status}`);
      }
      
      const data = await response.json();
      if (Array.isArray(data)) {
        setProducts(data);
      } else {
        setFetchError("O Google retornou um formato inválido. Verifique se o Script está publicado como 'Qualquer Pessoa'.");
      }
    } catch (error) {
      console.error("Erro ao buscar produtos", error);
      setFetchError("Erro de Conexão: " + error.message + ". Verifique se a URL do Script está correta e se você autorizou o acesso na planilha.");
    }
    setIsLoading(false);
  };

  const fetchUsers = async () => {
    try {
      const response = await fetch(`${SCRIPT_URL}?action=getUsers`, { redirect: 'follow' });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();
      setUsers(data);
    } catch (error) {
      console.error("Erro ao buscar usuários", error);
      // Opcional: Notificar silenciosamente ou via toast
    }
  };

  const fetchSalesHistory = async () => {
    try {
      const response = await fetch(`${SCRIPT_URL}?action=getSales`, { redirect: 'follow' });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();
      setSalesHistory(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error("Erro ao buscar histórico de vendas", error);
    }
  };

  const fetchSettings = async () => {
    try {
      const response = await fetch(`${SCRIPT_URL}?action=getSettings`, { redirect: 'follow' });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();
      if (data && data.businessName) {
        setSettings(data);
      }
    } catch (error) {
      console.error("Erro ao buscar configurações", error);
    }
  };


  useEffect(() => { 
    fetchProducts(); 
    fetchSettings();
    fetchUsers();
    fetchSalesHistory();
  }, []);

  // Analytics Logic
  const analytics = useMemo(() => {
    if (!Array.isArray(salesHistory)) return null;

    const productCounts = {};
    const paymentMethods = {};
    let totalRevenue = 0;
    let totalProfit = 0;

    // Initialize counts with products from the catalog to catch 0-sales items
    if (Array.isArray(products)) {
      products.forEach(p => {
        const name = p.name || p.nome;
        if (name) productCounts[name] = { qty: 0 };
      });
    }

    salesHistory.forEach(sale => {
      // DEBUG: console.log("Processing sale:", sale);
      // 1. Process Revenue & Profit
      const revenue = parseFloat(String(sale.total || 0).replace(',', '.')) || 0;
      const profit = parseFloat(String(sale.profit || 0).replace(',', '.')) || 0;
      totalRevenue += revenue;
      totalProfit += profit;

      // 2. Process Payment Methods (e.g., "PIX (R$ 10,00) + DINHEIRO (R$ 5,00)")
      const rawMethodStr = String(sale.paymentmethod || sale.payment_method || sale.paymentMethod || sale.pagamento || 'Outro');
      const methodParts = rawMethodStr.split(' + ');
      
      methodParts.forEach(part => {
        // Extract method name (everything before the first parenthesis or dash)
        let methodName = part.split(/[(-]/)[0].trim().toUpperCase();
        if (!methodName) methodName = 'OUTRO';

        let partRevenue = revenue;
        if (methodParts.length > 1) {
          // Try to extract value from parts like "(R$ 10,00)" or "(10.00)"
          const valMatch = part.match(/\((?:[^\d]*)([\d,.]+)(?:[^\d]*)\)/);
          if (valMatch) {
            partRevenue = parseFloat(valMatch[1].replace(',', '.')) || 0;
          }
        }

        if (!paymentMethods[methodName]) paymentMethods[methodName] = { total: 0, count: 0 };
        paymentMethods[methodName].total += partRevenue;
        paymentMethods[methodName].count += 1;
      });

      // 3. Process Products from itemsresume
      const items = String(sale.itemsresume || sale.items_resume || sale.itemsResume || '').split(',');
      items.forEach(item => {
        const match = item.trim().match(/^(\d+)x\s+(.+)$/);
        if (match) {
          const qty = parseInt(match[1]);
          const name = match[2].trim();
          if (!productCounts[name]) productCounts[name] = { qty: 0 };
          productCounts[name].qty += qty;
        }
      });
    });

    // Sort products
    const sortedProducts = Object.entries(productCounts)
      .map(([name, data]) => ({ name, ...data }))
      .sort((a, b) => b.qty - a.qty);

    // 4. Periodic History
    const history = {};
    salesHistory.forEach(sale => {
      const dateStr = String(sale.date || sale.date || sale.data_hora || sale.data_hora || '').trim();
      if (!dateStr) return;

      let day, month, year;
      if (dateStr.includes('/')) {
        const parts = dateStr.split(' ')[0].split('/');
        if (parts.length < 3) return;
        day = parseInt(parts[0], 10);
        month = parseInt(parts[1], 10);
        year = parseInt(parts[2], 10);
      } else if (dateStr.includes('-')) {
        const parts = dateStr.split('T')[0].split('-');
        if (parts.length < 3) return;
        year = parseInt(parts[0], 10);
        month = parseInt(parts[1], 10);
        day = parseInt(parts[2], 10);
      } else {
        return;
      }

      if (isNaN(day) || isNaN(month) || isNaN(year)) return;
      if (year < 100) year += 2000;
      
      const dateObj = new Date(year, month - 1, day);
      if (isNaN(dateObj.getTime())) return;

      let key;
      if (historyPeriod === 'day') {
        key = `${day.toString().padStart(2, '0')}/${month.toString().padStart(2, '0')}/${year}`;
      } else if (historyPeriod === 'month') {
        key = `${month.toString().padStart(2, '0')}/${year}`;
      } else if (historyPeriod === 'year') {
        key = `${year}`;
      } else if (historyPeriod === 'week') {
        const d = new Date(dateObj);
        const dayOfWeek = d.getDay();
        const diff = d.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1);
        const startOfWeek = new Date(d.setDate(diff));
        key = `Semana ${startOfWeek.getDate().toString().padStart(2, '0')}/${(startOfWeek.getMonth() + 1).toString().padStart(2, '0')}`;
      }

      if (!history[key]) history[key] = { revenue: 0, profit: 0, count: 0, timestamp: dateObj.getTime() };
      const revenue = parseFloat(String(sale.total || 0).replace(',', '.')) || 0;
      const profit = parseFloat(String(sale.profit || 0).replace(',', '.')) || 0;
      history[key].revenue += revenue;
      history[key].profit += profit;
      history[key].count += 1;
    });

    const sortedHistory = Object.entries(history)
      .map(([label, data]) => ({ label, ...data }))
      .sort((a, b) => b.timestamp - a.timestamp);

    return {
      totalSales: salesHistory.length,
      totalRevenue,
      totalProfit,
      ticketMedio: salesHistory.length > 0 ? totalRevenue / salesHistory.length : 0,
      mostSold: sortedProducts.slice(0, 5),
      leastSold: sortedProducts.slice().reverse().slice(0, 5),
      payments: Object.entries(paymentMethods).map(([name, data]) => ({ name, ...data }))
        .sort((a, b) => b.total - a.total),
      periodicHistory: sortedHistory
    };
  }, [salesHistory, products, historyPeriod]);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(err => {
        alert(`Erro ao entrar em tela cheia: ${err.message}`);
      });
    } else {
      document.exitFullscreen();
    }
  };

  const handleSaveProduct = async (productData) => {
    try {
      const response = await fetch(SCRIPT_URL, {
        method: 'POST',
        redirect: 'follow',
        body: JSON.stringify({
          action: 'saveProduct',
          productData
        })
      });
      if (!response.ok) throw new Error(`Erro HTTP: ${response.status}`);
      const data = await response.json();
      if (data.status === 'error') throw new Error(data.message);
      
      fetchProducts();
      setEditingProduct(null);
      alert("Produto salvo com sucesso!");
    } catch (error) {
      alert("Erro ao salvar produto: " + error.message);
    }
  };

  const handleDeleteProduct = async (productId) => {
    if (!confirm("Tem certeza que deseja excluir este produto?")) return;
    try {
      const response = await fetch(SCRIPT_URL, {
        method: 'POST',
        redirect: 'follow',
        body: JSON.stringify({
          action: 'deleteProduct',
          productId
        })
      });
      if (!response.ok) throw new Error(`Erro HTTP: ${response.status}`);
      fetchProducts();
      alert("Produto excluído!");
    } catch (error) {
      alert("Erro ao excluir produto: " + error.message);
    }
  };

  const handleSaveUser = async (userData) => {
    try {
      const response = await fetch(SCRIPT_URL, {
        method: 'POST',
        redirect: 'follow',
        body: JSON.stringify({
          action: 'saveUser',
          userData
        })
      });
      await response.json();
      fetchUsers();
    } catch (error) {
      alert("Erro ao salvar usuário: " + error.message);
    }
  };

  const handleDeleteUser = async (userId) => {
    if (!confirm("Excluir este usuário?")) return;
    try {
      const response = await fetch(SCRIPT_URL, {
        method: 'POST',
        redirect: 'follow',
        body: JSON.stringify({
          action: 'deleteUser',
          userId
        })
      });
      await response.json();
      fetchUsers();
    } catch (error) {
      alert("Erro ao excluir usuário: " + error.message);
    }
  };

  const handleSaveSettings = async (settingsData) => {
    try {
      const response = await fetch(SCRIPT_URL, {
        method: 'POST',
        redirect: 'follow',
        body: JSON.stringify({
          action: 'saveSettings',
          settingsData
        })
      });
      await response.json();
      setSettings(settingsData);
    } catch (error) {
      alert("Erro ao salvar configurações: " + error.message);
    }
  };

  const filteredProducts = useMemo(() => {
    if (!searchTerm) return products;
    return products.filter(p => p.name.toLowerCase().includes(searchTerm.toLowerCase()));
  }, [searchTerm, products]);

  // Funções do Carrinho
  const addToCart = (product) => {
    setCart(prev => {
      const existing = prev.find(item => item.product.id === product.id);
      if (existing) {
        return prev.map(item => item.product.id === product.id ? { ...item, quantity: item.quantity + 1 } : item);
      }
      return [...prev, { product, quantity: 1 }];
    });
  };

  const updateQuantity = (productId, delta) => {
    setCart(prev => prev.map(item => {
      if (item.product.id === productId) {
        const newQty = item.quantity + delta;
        if (newQty <= 0) return null;
        return { ...item, quantity: newQty };
      }
      return item;
    }).filter(Boolean));
  };

  const removeFromCart = (productId) => setCart(prev => prev.filter(item => item.product.id !== productId));

  const cartData = useMemo(() => {
    let totalItems = 0; let subtotal = 0; let savings = 0;
    const items = cart.map(item => {
      const { product, quantity } = item;
      
      // Suporte para nomes de propriedades em minúsculo ou camelCase vindos da planilha
      const pVarejo = parseFloat(product.pricevarejo || product.priceVarejo || 0);
      const pAtacado = parseFloat(product.priceatacado || product.priceAtacado || 0);
      const mAtacado = parseInt(product.minatacado || product.minAtacado || 0);
      
      const isAtacado = mAtacado > 0 && quantity >= mAtacado && pAtacado < pVarejo;
      const appliedPrice = isAtacado ? pAtacado : pVarejo;
      const itemTotal = appliedPrice * quantity;

      if (isAtacado) savings += ((pVarejo * quantity) - itemTotal);
      totalItems += quantity; subtotal += itemTotal;
      return { ...item, appliedPrice, isAtacado, itemTotal };
    });
    return { items, totalItems, subtotal, savings };
  }, [cart]);

  // Cálculos de Pagamento Múltiplo
  const formatMoney = (value) => {
    const val = typeof value === 'string' ? parseFloat(value.replace(/[^\d.-]/g, '')) : value;
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val || 0);
  };

  const totalPaid = payments.reduce((acc, p) => acc + p.amount, 0);
  const remainingTotal = Math.max(0, cartData.subtotal - totalPaid);
  const change = Math.max(0, totalPaid - cartData.subtotal);
  const isPaymentValid = cartData.subtotal > 0 && totalPaid >= cartData.subtotal;

  const handleAddPayment = () => {
    let amt = parseFloat(currentAmountText.replace(',', '.')) || 0;

    // Auto-preencher valor que falta caso o usuário não tenha digitado
    if (amt <= 0) amt = remainingTotal;
    if (amt <= 0) return;

    // Validação de Fiado
    if (currentMethod === 'fiado' && !fiadoName.trim()) {
      alert("Por favor, informe o Nome do Cliente para lançar na conta/fiado.");
      return;
    }

    setPayments(prev => [...prev, {
      method: currentMethod,
      amount: amt,
      customerName: currentMethod === 'fiado' ? fiadoName : null,
      customerDoc: currentMethod === 'fiado' ? fiadoDoc : null
    }]);

    setCurrentAmountText('');
    setFiadoName('');
    setFiadoDoc('');
  };

  const removePayment = (index) => setPayments(prev => prev.filter((_, i) => i !== index));

  const openCheckout = () => {
    setPayments([]);
    setCurrentMethod('pix');
    setCurrentAmountText('');
    setFiadoName('');
    setFiadoDoc('');
    setIsCheckoutOpen(true);
  };

  const handlePrintReceipt = async () => {
    const element = receiptRef.current;
    if (!element) return;
    const opt = {
      margin: 0.5, filename: `Recibo_Venda_${new Date().getTime()}.pdf`,
      image: { type: 'jpeg', quality: 0.98 }, html2canvas: { scale: 2 },
      jsPDF: { unit: 'in', format: [3.15, 6], orientation: 'portrait' }
    };
    html2pdf().set(opt).from(element).save();
  };

  const [isFinishing, setIsFinishing] = useState(false);

  const finishSale = async () => {
    if (!isPaymentValid) return;
    setIsFinishing(true);

    const itemsResume = cartData.items.map(i => `${i.quantity}x ${i.product.name}`).join(", ");

    const stringPayments = payments.map(p => {
      const base = `${p.method.toUpperCase()} (${formatMoney(p.amount)})`;
      return p.customerName ? `${base} - Fiado: ${p.customerName}` : base;
    }).join(' + ');

    const profit = cartData.items.reduce((acc, item) => {
      const pPrice = parseFloat(item.product.purchasePrice) || 0;
      return acc + (item.quantity * (item.appliedPrice - pPrice));
    }, 0);

    const saleId = crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2, 15);

    try {
      const response = await fetch(SCRIPT_URL, {
        method: 'POST',
        redirect: 'follow',
        body: JSON.stringify({
          action: 'saveSale',
          saleData: {
            id: saleId,
            items: cart,
            itemsResume,
            total: cartData.subtotal,
            profit,
            paymentMethod: stringPayments,
            change,
            user: currentUser?.name || 'Balcão'
          }
        })
      });
      
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();
      if (data.status === 'error') throw new Error(data.message);

      alert("Venda registrada com sucesso no Google Sheets!");
      setCart([]);
      setIsCheckoutOpen(false);
      fetchProducts();
      fetchSalesHistory();
    } catch (ex) {
      console.error(ex);
      alert("Erro ao registrar a venda: " + ex.message);
    }
    setIsFinishing(false);
  };

  const handleDeleteSale = async (saleId) => {
    if (!saleId) {
      alert("Esta venda não possui ID persistente para exclusão.");
      return;
    }
    if (!confirm("Excluir esta venda permanentemente?")) return;
    try {
      console.log("Iniciando exclusão da venda:", saleId);
      const response = await fetch(SCRIPT_URL, {
        method: 'POST',
        redirect: 'follow',
        body: JSON.stringify({ action: 'deleteSale', saleId })
      });
      
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();
      
      if (data.status === 'success') {
        fetchSalesHistory();
        alert("Venda excluída!");
      } else {
        throw new Error(data.message || "Erro desconhecido no servidor.");
      }
    } catch (error) {
      console.error("Erro ao excluir venda:", error);
      alert("Erro ao excluir: " + error.message);
    }
  };

  const handleEditSale = async (sale) => {
    const newMethod = prompt("Nova forma de pagamento:", sale.paymentMethod);
    if (!newMethod || newMethod === sale.paymentMethod) return;
    try {
      console.log("Iniciando edição da venda:", sale.id);
      const response = await fetch(SCRIPT_URL, {
        method: 'POST',
        redirect: 'follow',
        body: JSON.stringify({ action: 'editSale', saleData: { ...sale, paymentMethod: newMethod } })
      });
      
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();
      
      if (data.status === 'success') {
        fetchSalesHistory();
        alert("Venda editada!");
      } else {
        throw new Error(data.message || "Erro desconhecido no servidor.");
      }
    } catch (error) {
      console.error("Erro ao editar venda:", error);
      alert("Erro ao editar: " + error.message);
    }
  };

  // Controle de Autenticação
  const [authView, setAuthView] = useState('login'); // 'login', 'signup', 'forgotPassword'
  const [loginEmail, setLoginEmail] = useState('');
  const [signupData, setSignupData] = useState({ name: '', email: '', password: '' });
  const [forgotEmail, setForgotEmail] = useState('');
  const [authLoading, setAuthLoading] = useState(false);

  const handleLogin = async (e) => {
    e.preventDefault();
    if (!loginEmail || !password) {
      setLoginError('Preencha todos os campos.');
      return;
    }
    
    setAuthLoading(true);
    setLoginError('');
    try {
      const response = await fetch(SCRIPT_URL, {
        method: 'POST',
        redirect: 'follow',
        body: JSON.stringify({
          action: 'loginUser',
          email: loginEmail,
          password: password
        })
      });
      const data = await response.json();
      if (data.status === 'success') {
        setCurrentUser(data.user);
        localStorage.setItem('blitz_user', JSON.stringify(data.user));
      } else {
        setLoginError(data.message);
      }
    } catch {
      setLoginError('Erro ao conectar com o servidor.');
    }
    setAuthLoading(false);
  };

  const handleSignup = async (e) => {
    e.preventDefault();
    if (!signupData.name || !signupData.email || !signupData.password) {
      setLoginError('Preencha todos os campos.');
      return;
    }
    
    setAuthLoading(true);
    setLoginError('');
    try {
      const response = await fetch(SCRIPT_URL, {
        method: 'POST',
        redirect: 'follow',
        body: JSON.stringify({
          action: 'registerUser',
          userData: {
            ...signupData,
            role: 'Operador',
            status: 'Ativo'
          }
        })
      });
      const data = await response.json();
      if (data.status === 'success') {
        alert("Conta criada com sucesso! Faça login agora.");
        setAuthView('login');
        setLoginEmail(signupData.email);
        setSignupData({ name: '', email: '', password: '' });
      } else {
        setLoginError(data.message);
      }
    } catch {
      setLoginError('Erro ao conectar com o servidor.');
    }
    setAuthLoading(false);
  };

  const handleForgotPassword = async (e) => {
    e.preventDefault();
    if (!forgotEmail) {
      setLoginError('Digite seu e-mail.');
      return;
    }
    
    setAuthLoading(true);
    setLoginError('');
    try {
      const response = await fetch(`${SCRIPT_URL}?action=forgotPassword&email=${encodeURIComponent(forgotEmail)}`, { redirect: 'follow' });
      const data = await response.json();
      if (data.status === 'success') {
        alert("E-mail com sua senha foi enviado!");
        setAuthView('login');
      } else {
        setLoginError(data.message);
      }
    } catch (error) {
      console.error("Erro ao recuperar senha:", error);
      setLoginError('Erro ao conectar com o servidor.');
    }
    setAuthLoading(false);
  };

  const handleLogout = () => {
    setCurrentUser(null);
    localStorage.removeItem('blitz_user');
  };

  if (!currentUser) {
    return (
      <div className="login-container">
        <div className="login-card">
          <div className="login-logo">BLITZ</div>
          
          {authView === 'login' && (
            <>
              <h2 className="login-title">Acesso ao Sistema</h2>
              <form onSubmit={handleLogin}>
                <div className="form-group">
                  <label>E-mail</label>
                  <input 
                    type="email" 
                    className="form-input" 
                    placeholder="ex@email.com" 
                    value={loginEmail} 
                    onChange={(e) => setLoginEmail(e.target.value)}
                    autoFocus
                  />
                </div>
                <div className="form-group">
                  <label>Senha</label>
                  <input 
                    type="password" 
                    className="form-input" 
                    placeholder="Sua senha" 
                    value={password} 
                    onChange={(e) => setPassword(e.target.value)}
                  />
                </div>
                {loginError && <div className="login-error">{loginError}</div>}
                <button type="submit" className="btn-add" style={{ width: '100%', marginTop: '1.5rem', height: '50px' }} disabled={authLoading}>
                  {authLoading ? 'Verificando...' : 'ENTRAR NO SISTEMA'}
                </button>
              </form>
              <div style={{ marginTop: '1.5rem', display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                <button className="link-btn" onClick={() => { setAuthView('signup'); setLoginError(''); }}>Criar Conta</button>
                <button className="link-btn" onClick={() => { setAuthView('forgotPassword'); setLoginError(''); }}>Esqueci a Senha</button>
              </div>
            </>
          )}

          {authView === 'signup' && (
            <>
              <h2 className="login-title">Cadastro de Usuário</h2>
              <form onSubmit={handleSignup}>
                <div className="form-group">
                  <label>Nome Completo</label>
                  <input 
                    className="form-input" 
                    placeholder="Digite seu nome..." 
                    value={signupData.name} 
                    onChange={(e) => setSignupData({...signupData, name: e.target.value})}
                  />
                </div>
                <div className="form-group">
                  <label>E-mail</label>
                  <input 
                    type="email" 
                    className="form-input" 
                    placeholder="ex@email.com" 
                    value={signupData.email} 
                    onChange={(e) => setSignupData({...signupData, email: e.target.value})}
                  />
                </div>
                <div className="form-group">
                  <label>Senha</label>
                  <input 
                    type="password" 
                    className="form-input" 
                    placeholder="Mínimo 6 caracteres" 
                    value={signupData.password} 
                    onChange={(e) => setSignupData({...signupData, password: e.target.value})}
                  />
                </div>
                {loginError && <div className="login-error">{loginError}</div>}
                <button type="submit" className="btn-primary" style={{ width: '100%', marginTop: '1rem' }} disabled={authLoading}>
                  {authLoading ? 'Criando Conta...' : 'Cadastrar'}
                </button>
                <button type="button" className="btn-secondary" style={{ width: '100%', marginTop: '0.5rem' }} onClick={() => setAuthView('login')}>
                  Voltar para Login
                </button>
              </form>
            </>
          )}

          {authView === 'forgotPassword' && (
            <>
              <h2 className="login-title">Recuperar Senha</h2>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '1.5rem', textAlign: 'center' }}>
                Enviaremos sua senha para o e-mail cadastrado.
              </p>
              <form onSubmit={handleForgotPassword}>
                <div className="form-group">
                  <label>Seu E-mail</label>
                  <input 
                    type="email" 
                    className="form-input" 
                    placeholder="ex@email.com" 
                    value={forgotEmail} 
                    onChange={(e) => setForgotEmail(e.target.value)}
                    autoFocus
                  />
                </div>
                {loginError && <div className="login-error">{loginError}</div>}
                <button type="submit" className="btn-primary" style={{ width: '100%', marginTop: '1rem' }} disabled={authLoading}>
                  {authLoading ? 'Enviando...' : 'Enviar E-mail'}
                </button>
                <button type="button" className="btn-secondary" style={{ width: '100%', marginTop: '0.5rem' }} onClick={() => setAuthView('login')}>
                  Voltar para Login
                </button>
              </form>
            </>
          )}

          <div className="login-footer">© 2024 Blitz PDV - Luxo & Eficiência</div>
        </div>
      </div>
    );
  }

  return (
    <div className="app-container">
      <main className="main-content scroll-hidden">
        <header className="header">
          <div className="logo-area">
            <div className="logo">{settings.businessName}</div>
            <div className="user-badge">
              <Users size={16} /> {currentUser.name} <span className="badge-admin">{currentUser.role}</span>
            </div>
          </div>
          <div className="header-actions">
            <button className="icon-btn" onClick={() => setIsSalesModalOpen(true)} title="Monitoramento de Vendas"><TrendingUp size={20} /></button>
            <button className="icon-btn" onClick={() => setIsProductsModalOpen(true)} title="Gerenciar Produtos"><Package size={20} /></button>
            <button className="icon-btn" onClick={() => setIsUsersModalOpen(true)} title="Gerenciar Usuários"><Users size={20} /></button>
            <button className="icon-btn" onClick={toggleFullscreen} title="Tela Cheia"><Maximize size={20} /></button>
            <button className="icon-btn" onClick={() => setIsSettingsModalOpen(true)} title="Configurações"><Settings size={20} /></button>
            <button className="icon-btn" onClick={handleLogout} title="Sair"><LogOut size={20} /></button>
          </div>
        </header>

        <div className="search-container">
          <Search className="search-icon" size={20} />
          <input
            type="text" className="search-input"
            placeholder="Buscar produtos (Nome ou Código de Barras)..."
            value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} autoFocus
          />
        </div>

        <div className="products-grid">
          {isLoading ? (
            <div style={{ color: 'var(--text-muted)' }}>Carregando produtos da Planilha...</div>
          ) : fetchError ? (
            <div className="error-box" style={{ background: '#ef444422', padding: '2rem', borderRadius: '12px', border: '1px solid #ef444455', color: '#ef4444', textAlign: 'center', width: '100%' }}>
              <X size={48} style={{ marginBottom: '1rem' }} />
              <h3 style={{ marginBottom: '0.5rem' }}>Erro ao Carregar Dados</h3>
              <p style={{ fontSize: '0.9rem', marginBottom: '1rem' }}>{fetchError}</p>
              <button className="btn-primary" onClick={fetchProducts} style={{ margin: '0 auto' }}>Tentar Novamente</button>
            </div>
          ) : filteredProducts.length === 0 ? (
            <div style={{ color: 'var(--text-muted)' }}>Nenhum produto encontrado. Verifique sua planilha e a conexão.</div>
          ) : filteredProducts.map(product => {
            const priceV = product.pricevarejo || product.priceVarejo || 0;
            const priceA = product.priceatacado || product.priceAtacado || 0;
            const minA = product.minatacado || product.minAtacado || 0;
            return (
            <div key={product.id || product.ID || Math.random()} className="product-card">
              <h3 className="product-title">{product.name || 'Sem Nome'}</h3>
              <div className="product-price-row">
                <span className="price-icon">$</span><span className="price-value">{formatMoney(priceV)}</span><span className="price-label">(Varejo)</span>
              </div>
              <div className="product-atacado-row">
                <CheckCircle2 className="atacado-icon" size={14} />
                <div>
                  <span className="atacado-text">{formatMoney(priceA)}</span>
                  <span className="atacado-subtext">(Atacado a partir de {minA})</span>
                </div>
              </div>
              <div className="product-stock"><Package size={14} /> Estoque: {product.stock}</div>
              <button className="btn-add" onClick={() => addToCart(product)}><PlusCircle size={18} /> Adicionar</button>
            </div>
          )})}
        </div>
      </main>

      {/* Sidebar Carrinho */}
      <aside className="sidebar">
        <div className="cart-header"><ShoppingCart size={24} /> Carrinho</div>
        {cartData.items.length === 0 ? (
          <div className="cart-empty">Seu carrinho está vazio.</div>
        ) : (
          <>
            <div className="cart-items scroll-hidden">
              {cartData.items.map((cartItem) => (
                <div key={cartItem.product.id} className="cart-item">
                  <div className="cart-item-header">
                    <span className="cart-item-title">{cartItem.product.name}</span>
                    <button className="btn-remove" onClick={() => removeFromCart(cartItem.product.id)}><Trash2 size={16} /></button>
                  </div>
                  <div className="cart-item-controls">
                    <div className="qty-controls">
                      <button className="btn-qty" onClick={() => updateQuantity(cartItem.product.id, -1)}><Minus size={14} /></button>
                      <span className="qty-value">{cartItem.quantity}</span>
                      <button className="btn-qty" onClick={() => updateQuantity(cartItem.product.id, 1)}><Plus size={14} /></button>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div className="cart-item-price">{formatMoney(cartItem.appliedPrice)}</div>
                      <div className="cart-item-total">Total: {formatMoney(cartItem.itemTotal)}</div>
                    </div>
                  </div>
                  {cartItem.isAtacado && <div><span className="badge-atacado-active">Preço de Atacado Aplicado ✓</span></div>}
                </div>
              ))}
            </div>

            <div className="cart-footer">
              <div className="cart-total-row"><span>Subtotal ({cartData.totalItems} itens)</span><span>{formatMoney(cartData.subtotal + cartData.savings)}</span></div>
              {cartData.savings > 0 && <div className="cart-total-row" style={{ color: 'var(--success-green)' }}><span>Desconto Atacado</span><span>- {formatMoney(cartData.savings)}</span></div>}
              <div className="cart-total-row grand-total"><span>Total</span><span>{formatMoney(cartData.subtotal)}</span></div>

              <button className="btn-checkout" onClick={openCheckout}>
                <CheckCircle2 size={20} /> Finalizar Venda
              </button>
            </div>
          </>
        )}
      </aside>

      {/* Modal Pagamento Múltiplo */}
      {isCheckoutOpen && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h2 className="modal-title">Finalizar Venda</h2>
              <button className="btn-close" onClick={() => setIsCheckoutOpen(false)}><X size={24} /></button>
            </div>

            <div className="modal-body">
              {/* Esquerda: Métodos de Pagamento */}
              <div className="checkout-payment-col">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '1.5rem' }}>
                  <div>
                    <h3 style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>MÉTODO DE PAGAMENTO</h3>
                  </div>
                  <div style={{ fontSize: '1.25rem', fontWeight: 'bold' }}>
                    Faltam: <span style={{ color: 'var(--accent-orange)' }}>{formatMoney(remainingTotal)}</span>
                  </div>
                </div>

                <div className="payment-methods-grid" style={{ marginBottom: '1.5rem', marginTop: 0 }}>
                  <button className={`btn-payment-method ${currentMethod === 'pix' ? 'active' : ''}`} onClick={() => setCurrentMethod('pix')}>
                    <Smartphone size={24} /> PIX
                  </button>
                  <button className={`btn-payment-method ${currentMethod === 'cartao' ? 'active' : ''}`} onClick={() => setCurrentMethod('cartao')}>
                    <CreditCard size={24} /> Cartão
                  </button>
                  <button className={`btn-payment-method ${currentMethod === 'dinheiro' ? 'active' : ''}`} onClick={() => setCurrentMethod('dinheiro')}>
                    <Banknote size={24} /> Dinheiro
                  </button>
                  <button className={`btn-payment-method ${currentMethod === 'fiado' ? 'active' : ''}`} onClick={() => setCurrentMethod('fiado')}>
                    <Users size={24} /> Conta/Fiado
                  </button>
                </div>

                {currentMethod === 'fiado' && (
                  <div className="fiado-inputs">
                    <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', marginBottom: '0.25rem' }}>
                      <UserPlus size={18} color="var(--accent-orange)" />
                      <span style={{ fontWeight: 'bold', fontSize: '0.9rem' }}>Dados do Cliente</span>
                    </div>
                    <input type="text" className="input-text" placeholder="Nome do Cliente (Obrigatório)" value={fiadoName} onChange={e => setFiadoName(e.target.value)} />
                    <input type="text" className="input-text" placeholder="CPF/Telefone (Opcional)" value={fiadoDoc} onChange={e => setFiadoDoc(e.target.value)} />
                  </div>
                )}

                <div style={{ marginTop: '1rem', display: 'flex', gap: '0.5rem', background: 'var(--bg-sidebar)', padding: '1rem', borderRadius: 'var(--radius)', border: '1px dashed var(--border-color)' }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>Valor a lançar:</div>
                    <input
                      type="number"
                      className="input-money"
                      style={{ marginBottom: 0 }}
                      placeholder={`R$ ${remainingTotal.toFixed(2)}`}
                      value={currentAmountText}
                      onChange={(e) => setCurrentAmountText(e.target.value)}
                    />
                  </div>
                  <button className="btn-primary" style={{ marginTop: '1.4rem' }} disabled={remainingTotal <= 0} onClick={handleAddPayment}>
                    <Plus size={20} /> Adicionar Pagamento
                  </button>
                </div>

                {payments.length > 0 && (
                  <div className="payment-list">
                    <h4 style={{ marginBottom: '0.75rem', color: 'var(--text-muted)' }}>Pagamentos Confirmados:</h4>
                    {payments.map((p, idx) => (
                      <div key={idx} className="payment-item">
                        <div>
                          <span style={{ textTransform: 'uppercase', fontWeight: 'bold' }}>{p.method}</span>
                          {p.customerName && <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}> - {p.customerName}</span>}
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                          <span style={{ fontWeight: 'bold' }}>{formatMoney(p.amount)}</span>
                          <button className="payment-item-btn" onClick={() => removePayment(idx)} title="Remover"><Trash2 size={16} /></button>
                        </div>
                      </div>
                    ))}

                    {change > 0 && (
                      <div className="change-display" style={{ marginTop: '1.5rem' }}>
                        <div className="change-label">TROCO A DEVOLVER</div>
                        <div className="change-amount">{formatMoney(change)}</div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Direita: Recibo */}
              <div className="checkout-receipt-col scroll-hidden">
                <div className="receipt-wrapper" ref={receiptRef}>
                  <div className="receipt-header">
                    <div className="receipt-logo">{settings.businessName}</div>
                    <div className="receipt-info" style={{ color: '#666' }}>
                      <span>CNPJ: {settings.cnpj}</span>
                      <span>{settings.address}</span>
                      <span>Data: {new Date().toLocaleDateString('pt-BR')} {new Date().toLocaleTimeString('pt-BR')}</span>
                    </div>
                  </div>

                  <div style={{ textAlign: 'center', fontWeight: 'bold', margin: '10px 0' }}>CUPOM NÃO FISCAL</div>

                  <div className="receipt-items">
                    <div className="receipt-item" style={{ fontWeight: 'bold', borderBottom: '1px solid #ddd', paddingBottom: '4px' }}>
                      <span style={{ flex: 2 }}>ITEM</span>
                      <span style={{ flex: 1, textAlign: 'center' }}>QTD</span>
                      <span style={{ flex: 1, textAlign: 'right' }}>VALOR</span>
                    </div>

                    {cartData.items.map(item => (
                      <div key={item.product.id} className="receipt-item" style={{ marginTop: '4px' }}>
                        <span style={{ flex: 2, marginRight: '8px' }}>{item.product.name} {item.isAtacado ? '(AT)' : ''}</span>
                        <span style={{ flex: 1, textAlign: 'center' }}>{item.quantity}</span>
                        <span style={{ flex: 1, textAlign: 'right' }}>{formatMoney(item.itemTotal)}</span>
                      </div>
                    ))}
                  </div>

                  <div className="receipt-divider"></div>

                  <div className="receipt-totals">
                    <div className="receipt-item">
                      <span>Subtotal:</span>
                      <span>{formatMoney(cartData.subtotal + cartData.savings)}</span>
                    </div>
                    {cartData.savings > 0 && (
                      <div className="receipt-item">
                        <span>Descontos:</span>
                        <span>-{formatMoney(cartData.savings)}</span>
                      </div>
                    )}
                    <div className="receipt-item" style={{ fontSize: '14px', fontWeight: 'bold', marginTop: '4px' }}>
                      <span>TOTAL DA CONTA:</span>
                      <span>{formatMoney(cartData.subtotal)}</span>
                    </div>
                  </div>

                  <div className="receipt-divider"></div>

                  <div className="receipt-payment">
                    <div style={{ fontSize: '12px', fontWeight: 'bold', marginBottom: '4px' }}>PAGAMENTOS EFETUADOS:</div>
                    {payments.length === 0 ? (
                      <div className="receipt-item"><span>Pendente</span></div>
                    ) : (
                      payments.map((p, idx) => (
                        <div className="receipt-item" key={'rcpt-' + idx}>
                          <span>{p.method.toUpperCase()} {p.customerName ? `(${p.customerName.split(' ')[0]})` : ''}:</span>
                          <span>{formatMoney(p.amount)}</span>
                        </div>
                      ))
                    )}

                    {change > 0 && (
                      <div className="receipt-item" style={{ borderTop: '1px dashed #ccc', paddingTop: '4px', marginTop: '4px' }}>
                        <span>Troco Devolvido:</span>
                        <span>{formatMoney(change)}</span>
                      </div>
                    )}
                  </div>

                  <div style={{ textAlign: 'center', marginTop: '20px', fontSize: '10px', color: '#666' }}>
                    Obrigado pela preferência!<br />
                    Volte Sempre!
                  </div>
                </div>
              </div>
            </div>

            <div className="modal-footer">
              <button className="btn-secondary" onClick={() => setIsCheckoutOpen(false)}>Cancelar</button>
              <button className="btn-print" onClick={handlePrintReceipt}>
                <Printer size={18} /> Imprimir Recibo
              </button>
              <button
                className="btn-primary"
                disabled={!isPaymentValid || isFinishing}
                onClick={finishSale}
              >
                <CheckCircle2 size={18} /> {isFinishing ? 'Salvando...' : 'Confirmar Venda'}
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Modal Gerenciar Produtos */}
      {isProductsModalOpen && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '1000px' }}>
            <div className="modal-header">
              <h2 className="modal-title">Gerenciar Produtos</h2>
              <button className="btn-close" onClick={() => setIsProductsModalOpen(false)}><X size={24} /></button>
            </div>
            <div className="modal-body manage-grid">
              {/* Esquerda: Lista de Produtos */}
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                  <h3 style={{ color: 'var(--text-muted)' }}>Lista de Produtos</h3>
                  <button className="icon-btn" style={{ width: '32px', height: '32px' }} onClick={fetchProducts} title="Sincronizar">
                    <RefreshCw size={16} className={isLoading ? "spin" : ""} />
                  </button>
                </div>
                <div className="product-list-mini scroll-hidden">
                  {products.map(p => (
                    <div key={p.id} className="mini-item">
                      <div className="mini-item-info">
                        <span className="mini-item-name">{p.name}</span>
                        <span className="mini-item-price">{formatMoney(p.priceVarejo)} | Est: {p.stock}</span>
                      </div>
                      <div className="mini-actions">
                        <button className="btn-icon-sm" onClick={() => setEditingProduct(p)} title="Editar"><PlusCircle size={18} /></button>
                        <button className="btn-icon-sm btn-danger" onClick={() => handleDeleteProduct(p.id)} title="Excluir"><Trash2 size={18} /></button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Direita: Formulário */}
              <div style={{ background: 'var(--bg-dark)', padding: '1.5rem', borderRadius: 'var(--radius)', border: '1px solid var(--border-color)' }}>
                <h3 style={{ marginBottom: '1.5rem' }}>{editingProduct?.id ? 'Editar Produto' : 'Novo Produto'}</h3>
                <div className="form-group">
                  <label>Nome do Produto</label>
                  <input className="form-input" value={editingProduct?.name || ''} onChange={e => setEditingProduct({...editingProduct, name: e.target.value})} />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem' }}>
                  <div className="form-group">
                    <label>Preço Compra</label>
                    <input className="form-input" type="number" value={editingProduct?.purchasePrice || 0} onChange={e => setEditingProduct({...editingProduct, purchasePrice: parseFloat(e.target.value)})} />
                  </div>
                  <div className="form-group">
                    <label>Preço Varejo</label>
                    <input className="form-input" type="number" value={editingProduct?.priceVarejo || 0} onChange={e => setEditingProduct({...editingProduct, priceVarejo: parseFloat(e.target.value)})} />
                  </div>
                  <div className="form-group">
                    <label>Preço Atacado</label>
                    <input className="form-input" type="number" value={editingProduct?.priceAtacado || 0} onChange={e => setEditingProduct({...editingProduct, priceAtacado: parseFloat(e.target.value)})} />
                  </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                  <div className="form-group">
                    <label>Qtd. Mín Atacado</label>
                    <input className="form-input" type="number" value={editingProduct?.minAtacado || 1} onChange={e => setEditingProduct({...editingProduct, minAtacado: parseInt(e.target.value)})} />
                  </div>
                  <div className="form-group">
                    <label>Estoque Inicial</label>
                    <input className="form-input" type="number" value={editingProduct?.stock || 0} onChange={e => setEditingProduct({...editingProduct, stock: parseInt(e.target.value)})} />
                  </div>
                </div>
                <button className="btn-primary" style={{ width: '100%', marginTop: '1rem' }} onClick={() => handleSaveProduct(editingProduct)}>
                  Salvar Produto
                </button>
                <button className="btn-secondary" style={{ width: '100%', marginTop: '0.5rem' }} onClick={() => setEditingProduct({ name: '', purchasePrice: 0, priceVarejo: 0, priceAtacado: 0, minAtacado: 1, stock: 0 })}>
                  Limpar
                </button>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn-secondary" onClick={() => setIsProductsModalOpen(false)}>Fechar</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Configurações */}
      {isSettingsModalOpen && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '500px' }}>
            <div className="modal-header">
              <h2 className="modal-title">Configurações do Negócio</h2>
              <button className="btn-close" onClick={() => setIsSettingsModalOpen(false)}><X size={24} /></button>
            </div>
            <div className="modal-body" style={{ padding: '1.5rem', display: 'block' }}>
              <div className="form-group">
                <label>Nome Fantasia</label>
                <input className="form-input" value={settings.businessName} onChange={e => setSettings({...settings, businessName: e.target.value})} />
              </div>
              <div className="form-group">
                <label>CNPJ</label>
                <input className="form-input" value={settings.cnpj} onChange={e => setSettings({...settings, cnpj: e.target.value})} />
              </div>
              <div className="form-group">
                <label>Endereço Completo</label>
                <input className="form-input" value={settings.address} onChange={e => setSettings({...settings, address: e.target.value})} />
              </div>
              <div className="form-group">
                <label>Telefone de Contato</label>
                <input className="form-input" value={settings.phone} onChange={e => setSettings({...settings, phone: e.target.value})} />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn-secondary" onClick={() => setIsSettingsModalOpen(false)}>Cancelar</button>
              <button className="btn-primary" onClick={() => handleSaveSettings(settings)}>Salvar Configurações</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Gerenciar Usuários */}
      {isUsersModalOpen && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '900px' }}>
            <div className="modal-header">
              <h2 className="modal-title">Gerenciar Usuários</h2>
              <button className="btn-close" onClick={() => setIsUsersModalOpen(false)}><X size={24} /></button>
            </div>
            <div className="modal-body manage-grid">
              {/* Esquerda: Lista */}
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <h3 style={{ marginBottom: '1rem', color: 'var(--text-muted)' }}>Operadores do Sistema</h3>
                <div className="product-list-mini scroll-hidden">
                  {Array.isArray(users) && users.map(u => (
                    <div key={u.id} className="mini-item">
                      <div className="mini-item-info">
                        <span className="mini-item-name">{u.name}</span>
                        <span className="mini-item-price">{u.role} | {u.status}</span>
                      </div>
                      <div className="mini-actions">
                        <button className="btn-icon-sm" onClick={() => setEditingUser(u)} title="Editar"><PlusCircle size={18} /></button>
                        <button className="btn-icon-sm btn-danger" onClick={() => handleDeleteUser(u.id)} title="Excluir"><Trash2 size={18} /></button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              {/* Direita: Form */}
              <div style={{ background: 'var(--bg-dark)', padding: '1.5rem', borderRadius: 'var(--radius)', border: '1px solid var(--border-color)' }}>
                <h3 style={{ marginBottom: '1.5rem' }}>{editingUser?.id ? 'Editar Usuário' : 'Novo Usuário'}</h3>
                <div className="form-group">
                  <label>Nome Completo</label>
                  <input className="form-input" value={editingUser?.name || ''} onChange={e => setEditingUser({...editingUser, name: e.target.value})} />
                </div>
                <div className="form-group">
                  <label>Cargo / Perfil</label>
                  <select className="form-input" value={editingUser?.role || 'Operador'} onChange={e => setEditingUser({...editingUser, role: e.target.value})}>
                    <option value="Admin">Administrador</option>
                    <option value="Operador">Operador de Caixa</option>
                    <option value="Gerente">Gerente</option>
                  </select>
                </div>
                <div className="form-group">
                  <label>Status</label>
                  <select className="form-input" value={editingUser?.status || 'Ativo'} onChange={e => setEditingUser({...editingUser, status: e.target.value})}>
                    <option value="Ativo">Ativo</option>
                    <option value="Inativo">Inativo</option>
                  </select>
                </div>
                <button className="btn-primary" style={{ width: '100%', marginTop: '1rem' }} onClick={() => handleSaveUser(editingUser)}>
                  Salvar Usuário
                </button>
                <button className="btn-secondary" style={{ width: '100%', marginTop: '0.5rem' }} onClick={() => setEditingUser({ name: '', role: 'Operador', status: 'Ativo' })}>
                  Limpar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal Histórico de Vendas */}
      {isSalesModalOpen && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '1000px' }}>
            <div className="modal-header" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: '1rem' }}>
              <div style={{ display: 'flex', width: '100%', justifyContent: 'space-between', alignItems: 'center' }}>
                <h2 className="modal-title">Monitoramento de Vendas</h2>
                <div style={{ display: 'flex', gap: '1rem' }}>
                  <button className="icon-btn" onClick={fetchSalesHistory} title="Sincronizar"><RefreshCw size={18} /></button>
                  <button className="btn-close" onClick={() => setIsSalesModalOpen(false)}><X size={24} /></button>
                </div>
              </div>
              
              <div className="tab-nav" style={{ width: '100%', marginBottom: '0' }}>
                <button 
                  className={`tab-btn ${activeModalTab === 'history' ? 'active' : ''}`}
                  onClick={() => setActiveModalTab('history')}
                >
                  <History size={16} /> Histórico
                </button>
                <button 
                  className={`tab-btn ${activeModalTab === 'stats' ? 'active' : ''}`}
                  onClick={() => setActiveModalTab('stats')}
                >
                  <TrendingUp size={16} /> Estatísticas (Analytics)
                </button>
              </div>
            </div>

            <div className="modal-body" style={{ padding: activeModalTab === 'history' ? '0' : '1.5rem', display: 'block', overflowY: 'auto' }}>
              {activeModalTab === 'history' ? (
                <div className="product-list-mini scroll-hidden" style={{ maxHeight: '60vh', border: 'none', borderRadius: '0' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
                    <thead style={{ position: 'sticky', top: 0, background: 'var(--bg-card)', borderBottom: '1px solid var(--border-color)' }}>
                      <tr>
                        <th style={{ padding: '1rem', textAlign: 'left' }}>Data/Hora</th>
                        <th style={{ padding: '1rem', textAlign: 'left' }}>Itens</th>
                        <th style={{ padding: '1rem', textAlign: 'left' }}>Total</th>
                        <th style={{ padding: '1rem', textAlign: 'left' }}>Pagamento</th>
                        <th style={{ padding: '1rem', textAlign: 'left' }}>Vendedor</th>
                        <th style={{ padding: '1rem', textAlign: 'left' }}>Ações</th>
                      </tr>
                    </thead>
                    <tbody>
                      {Array.isArray(salesHistory) && salesHistory.map((s, idx) => (
                        <tr key={idx} style={{ borderBottom: '1px solid var(--border-color)' }}>
                          <td style={{ padding: '1rem' }}>{s.date || s.data_hora}</td>
                          <td style={{ padding: '1rem', fontSize: '0.8rem', color: 'var(--text-muted)' }}>{s.itemsresume || s.itemsResume}</td>
                          <td style={{ padding: '1rem', fontWeight: 'bold', color: 'var(--success-green)' }}>{formatMoney(s.total)}</td>
                          <td style={{ padding: '1rem' }}>{s.paymentmethod || s.paymentMethod || s.pagamento}</td>
                          <td style={{ padding: '1rem' }}>{s.user || s.vendedor || 'Balcão'}</td>
                          <td style={{ padding: '1rem', display: 'flex', gap: '0.5rem' }}>
                             <button className="btn-icon-sm" onClick={() => handleEditSale(s)} title="Editar"><PlusCircle size={16} /></button>
                             <button className="btn-icon-sm btn-danger" onClick={() => handleDeleteSale(s.id || s.ID)} title="Excluir"><Trash2 size={16} /></button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="analytics-dashboard">
                  <div className="stats-grid">
                    <div className="stat-card">
                      <span className="stat-label">Total de Vendas</span>
                      <span className="stat-value">{analytics?.totalSales}</span>
                    </div>
                    <div className="stat-card">
                      <span className="stat-label">Volume Total (Bruto)</span>
                      <span className="stat-value success">{formatMoney(analytics?.totalRevenue)}</span>
                    </div>
                    <div className="stat-card">
                      <span className="stat-label">Lucro Estimado</span>
                      <span className="stat-value" style={{ color: '#fbbf24' }}>{formatMoney(analytics?.totalProfit)}</span>
                    </div>
                    <div className="stat-card">
                      <span className="stat-label">Ticket Médio</span>
                      <span className="stat-value">{formatMoney(analytics?.ticketMedio)}</span>
                    </div>
                  </div>

                  <div className="ranking-container">
                    <div className="ranking-box">
                      <div className="ranking-header">
                        <PlusCircle size={16} color="var(--success-green)" /> TOP 5 Mais Vendidos
                      </div>
                      <table className="ranking-table">
                        <tbody>
                          {analytics?.mostSold.map((p, i) => (
                            <tr key={i}>
                              <td className="ranking-name">{p.name}</td>
                              <td className="ranking-count">{p.qty} un.</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    <div className="ranking-box">
                      <div className="ranking-header">
                        <PlusCircle size={16} style={{ transform: 'rotate(180deg)', color: '#ef4444' }} /> 5 Menos Vendidos
                      </div>
                      <table className="ranking-table">
                        <tbody>
                          {analytics?.leastSold.map((p, i) => (
                            <tr key={i}>
                              <td className="ranking-name">{p.name}</td>
                              <td className="ranking-count" style={{ color: 'var(--text-muted)' }}>{p.qty} un.</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  <div className="ranking-box" style={{ marginTop: '1.5rem' }}>
                    <div className="ranking-header" style={{ justifyContent: 'space-between' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <TrendingUp size={16} /> Histórico de Performance
                      </div>
                      <div className="tab-nav" style={{ marginBottom: '0', scale: '0.8', transformOrigin: 'right' }}>
                        <button className={`tab-btn ${historyPeriod === 'day' ? 'active' : ''}`} onClick={() => setHistoryPeriod('day')}>Dias</button>
                        <button className={`tab-btn ${historyPeriod === 'week' ? 'active' : ''}`} onClick={() => setHistoryPeriod('week')}>Semanas</button>
                        <button className={`tab-btn ${historyPeriod === 'month' ? 'active' : ''}`} onClick={() => setHistoryPeriod('month')}>Meses</button>
                        <button className={`tab-btn ${historyPeriod === 'year' ? 'active' : ''}`} onClick={() => setHistoryPeriod('year')}>Anos</button>
                      </div>
                    </div>
                    <div className="product-list-mini scroll-hidden" style={{ maxHeight: '300px', border: 'none', borderRadius: '0' }}>
                      <table className="ranking-table">
                        <thead style={{ position: 'sticky', top: 0, background: 'var(--bg-card)', borderBottom: '1px solid var(--border-color)', zIndex: 1 }}>
                          <tr>
                            <th style={{ padding: '0.75rem 1rem', textAlign: 'left', fontSize: '0.8rem', color: 'var(--text-muted)' }}>Período</th>
                            <th style={{ padding: '0.75rem 1rem', textAlign: 'right', fontSize: '0.8rem', color: 'var(--text-muted)' }}>Faturamento</th>
                            <th style={{ padding: '0.75rem 1rem', textAlign: 'right', fontSize: '0.8rem', color: 'var(--text-muted)' }}>Lucro</th>
                          </tr>
                        </thead>
                        <tbody>
                          {analytics?.periodicHistory.map((h, i) => (
                            <tr key={i}>
                              <td className="ranking-name">{h.label}</td>
                              <td className="ranking-count" style={{ color: 'var(--success-green)' }}>{formatMoney(h.revenue)}</td>
                              <td className="ranking-total" style={{ fontWeight: 'bold', color: 'var(--text-main)', fontSize: '0.85rem' }}>{formatMoney(h.profit)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  <div className="ranking-box" style={{ marginTop: '1.5rem' }}>
                    <div className="ranking-header">
                      <CreditCard size={16} /> Saldo por Método de Pagamento
                    </div>
                    <div style={{ padding: '1rem' }}>
                      {analytics?.payments.map((pay, i) => (
                        <div key={i} className="payment-sum-row">
                          <span style={{ textTransform: 'capitalize' }}>{pay.name}</span>
                          <span style={{ fontWeight: 'bold' }}>{formatMoney(pay.total)} <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 'normal' }}>({pay.count} vendas)</span></span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
            <div className="modal-footer">
              <div style={{ marginRight: 'auto', display: 'flex', gap: '2rem' }}>
                <div>Monitorando: <span style={{ fontWeight: 'bold' }}>{activeModalTab === 'history' ? 'Histórico' : 'Analytics'}</span></div>
              </div>
              <button className="btn-secondary" onClick={() => setIsSalesModalOpen(false)}>Fechar</button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

export default App;
