/**
 * Google Apps Script DEFINITIVO para PDV Blitz
 * Versão: 3.0 (Auto-Configurável e Auto-Reparável)
 * 
 * Este script detecta e cria automaticamente as abas e colunas necessárias.
 */

const SS = SpreadsheetApp.getActiveSpreadsheet();

// Configuração das Abas e Colunas obrigatórias
const SCHEMA = {
  'Usuarios': ['id', 'name', 'role', 'status', 'email', 'password'],
  'Produtos': ['id', 'name', 'purchasePrice', 'priceVarejo', 'priceAtacado', 'minAtacado', 'stock'],
  'Vendas': ['id', 'date', 'itemsResume', 'total', 'profit', 'paymentMethod', 'change', 'user'],
  'Config': ['businessName', 'cnpj', 'address', 'phone']
};

/**
 * Garante que a estrutura da planilha está correta. 
 * Se uma aba ou coluna faltar, ela é criada automaticamente.
 */
function ensureStructure() {
  console.log("Verificando estrutura da planilha...");
  Object.keys(SCHEMA).forEach(sheetName => {
    let sheet = getSheetFlexible(sheetName);
    if (!sheet) {
      console.warn(`Aba '${sheetName}' não encontrada. Criando...`);
      sheet = SS.insertSheet(sheetName);
      sheet.appendRow(SCHEMA[sheetName]);
    } else {
      // Verificar se faltam colunas
      const data = sheet.getDataRange().getValues();
      const existingHeaders = (data[0] || []).map(h => normalizeHeader(h));
      const requiredHeaders = SCHEMA[sheetName];
      
      requiredHeaders.forEach(req => {
        if (existingHeaders.indexOf(normalizeHeader(req)) === -1) {
          console.warn(`Coluna '${req}' faltando em '${sheetName}'. Adicionando ao final.`);
          const lastCol = sheet.getLastColumn();
          sheet.getRange(1, lastCol + 1).setValue(req);
        }
      });
    }
  });
  console.log("Verificação de estrutura concluída.");
}

function normalizeHeader(h) {
  return String(h || '').trim().toLowerCase()
    .replace(/[^a-z0-9]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '');
}

function doGet(e) {
  ensureStructure();
  const action = e.parameter.action;
  let result = [];
  
  try {
    if (action === 'getProducts') {
      result = getTableData('Produtos');
    } else if (action === 'getSales') {
      result = getTableData('Vendas');
      result.reverse();
    } else if (action === 'getSettings') {
      result = getTableData('Config')[0] || {};
    } else if (action === 'getUsers') {
      result = getTableData('Usuarios');
    } else if (action === 'forgotPassword') {
      return forgotPassword(e.parameter.email);
    } else {
      return sendResponse({ status: 'error', message: "Ação GET não reconhecida: " + action });
    }
    
    return ContentService.createTextOutput(JSON.stringify(result))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (error) {
    return sendResponse({ status: 'error', message: "Erro no backend (GET): " + error.toString() });
  }
}

function doPost(e) {
  ensureStructure();
  try {
    if (!e || !e.postData || !e.postData.contents) {
      return sendResponse({ status: 'error', message: 'Dados de POST ausentes. Se você testou pelo editor, clique em "Executar" não funciona; use o App.' });
    }
    const postData = JSON.parse(e.postData.contents);
    const action = postData.action;
    
    if (action === 'saveSale') {
      saveSaleToSheet(postData.saleData);
      updateStock(postData.saleData.items);
      return sendResponse({ status: 'success' });
    } else if (action === 'deleteSale') {
      deleteSaleFromSheet(postData.saleId);
      return sendResponse({ status: 'success' });
    } else if (action === 'editSale') {
      editSaleInSheet(postData.saleData);
      return sendResponse({ status: 'success' });
    } else if (action === 'saveProduct') {
      saveProductToSheet(postData.productData);
      return sendResponse({ status: 'success' });
    } else if (action === 'deleteProduct') {
      deleteProductFromSheet(postData.productId);
      return sendResponse({ status: 'success' });
    } else if (action === 'saveSettings') {
      saveSettingsToSheet(postData.settingsData);
      return sendResponse({ status: 'success' });
    } else if (action === 'saveUser') {
      saveUserToSheet(postData.userData);
      return sendResponse({ status: 'success' });
    } else if (action === 'deleteUser') {
      deleteUserFromSheet(postData.userId);
      return sendResponse({ status: 'success' });
    } else if (action === 'registerUser') {
      return registerUser(postData.userData);
    } else if (action === 'loginUser') {
      return loginUser(postData.email, postData.password);
    } else {
      return sendResponse({ status: 'error', message: 'Ação POST não reconhecida: ' + action });
    }
  } catch (error) {
    return sendResponse({ status: 'error', message: "Erro no backend (POST): " + error.toString() });
  }
}

function sendResponse(data) {
  return ContentService.createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

function getTableData(sheetName) {
  const sheet = getSheetFlexible(sheetName);
  if (!sheet) return [];
  
  const data = sheet.getDataRange().getValues();
  if (data.length < 2) return []; // Apenas cabeçalho ou vazio
  
  const headers = data[0].map(h => normalizeHeader(h));
  const rows = data.slice(1);
  
  return rows.map(row => {
    let obj = {};
    headers.forEach((header, i) => {
      if (header) obj[header] = row[i];
    });
    return obj;
  }).filter(item => {
    // Filtragem mais inteligente: deve ter pelo menos um valor não vazio
    return Object.values(item).some(v => v !== "" && v !== null && v !== undefined);
  });
}

function getSheetFlexible(name) {
  const target = normalizeHeader(name);
  const sheets = SS.getSheets();
  for (let s of sheets) {
    if (normalizeHeader(s.getName()) === target) return s;
  }
  return null;
}

function loginUser(email, password) {
  const inputEmail = String(email || '').toLowerCase().trim();
  const inputPass = String(password || '').trim();

  console.log(`Tentativa login: ${inputEmail} / Senha: ${inputPass}`);

  // Caso especial Master: agora com formato de e-mail válido
  if (inputPass === '123' && (inputEmail === 'admin@admin.com' || inputEmail === 'admin@blitz.com')) {
    console.log("Acesso MESTRE concedido.");
    return sendResponse({ 
      status: 'success', 
      user: { id: 'admin', name: 'Administrador (Mestre)', email: inputEmail, role: 'Admin', status: 'Ativo' } 
    });
  }

  const users = getTableData('Usuarios');
  console.log(`Buscando em ${users.length} usuários na planilha...`);
  const user = users.find(u => {
    const uEmail = String(u.email || u.e_mail || u.usuario || u.login || '').toLowerCase().trim();
    const uPass = String(u.password || u.senha || u.pass || '').trim();
    
    // Log para depurar valores vazios encontrados pelo subagent
    if (uEmail === inputEmail) {
      console.log(`Usuário encontrado! Verificando senha. Planilha: '${uPass}', Digitada: '${inputPass}'`);
      return uPass === inputPass;
    }
    return false;
  });
  
  if (user) {
    const sanitizedUser = {
      id: user.id || Utilities.getUuid(),
      name: user.name || user.nome || inputEmail.split('@')[0],
      email: inputEmail,
      role: user.role || 'Operador',
      status: user.status || 'Ativo'
    };
    if (sanitizedUser.status === 'Inativo') {
      return sendResponse({ status: 'error', message: 'Usuário inativo.' });
    }
    return sendResponse({ status: 'success', user: sanitizedUser });
  }
  
  return sendResponse({ status: 'error', message: 'E-mail ou senha incorretos' });
}

function registerUser(userData) {
  const users = getTableData('Usuarios');
  const email = String(userData.email || '').toLowerCase().trim();
  if (users.some(u => String(u.email || u.e_mail || '').toLowerCase().trim() === email)) {
    return sendResponse({ status: 'error', message: 'E-mail já cadastrado' });
  }
  saveUserToSheet(userData);
  return sendResponse({ status: 'success' });
}

function saveUserToSheet(user) {
  const sheet = getSheetFlexible('Usuarios');
  const data = sheet.getDataRange().getValues();
  const headers = data[0].map(h => normalizeHeader(h));
  
  const emailIdx = headers.indexOf('email');
  const passIdx = headers.indexOf('password');
  const nameIdx = headers.indexOf('name');
  
  let foundRow = -1;
  const rowId = user.id || Utilities.getUuid();
  
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][0]) === String(rowId)) {
      foundRow = i + 1;
      break;
    }
  }

  if (foundRow !== -1) {
    if (nameIdx !== -1) sheet.getRange(foundRow, nameIdx + 1).setValue(user.name);
    if (emailIdx !== -1) sheet.getRange(foundRow, emailIdx + 1).setValue(user.email);
    if (passIdx !== -1) sheet.getRange(foundRow, passIdx + 1).setValue(user.password);
  } else {
    const newRow = new Array(headers.length).fill("");
    newRow[0] = rowId;
    if (nameIdx !== -1) newRow[nameIdx] = user.name || "";
    if (headers.indexOf('role') !== -1) newRow[headers.indexOf('role')] = user.role || "Operador";
    if (headers.indexOf('status') !== -1) newRow[headers.indexOf('status')] = user.status || "Ativo";
    if (emailIdx !== -1) newRow[emailIdx] = user.email || "";
    if (passIdx !== -1) newRow[passIdx] = user.password || "";
    sheet.appendRow(newRow);
  }
}

// Funções auxiliares mantidas para compatibilidade
function saveSaleToSheet(sale) {
  const sheet = getSheetFlexible('Vendas');
  const date = new Date().toLocaleString('pt-BR');
  sheet.appendRow([
    sale.id || Utilities.getUuid(),
    date,
    sale.itemsResume,
    sale.total,
    sale.profit,
    sale.paymentMethod,
    sale.change,
    sale.user
  ]);
}

function updateStock(items) {
  const sheet = getSheetFlexible('Produtos');
  if (!sheet || !items) return;
  const data = sheet.getDataRange().getValues();
  const headers = data[0].map(h => normalizeHeader(h));
  const idCol = headers.indexOf('id');
  const stockCol = headers.indexOf('stock');

  if (idCol === -1 || stockCol === -1) return;

  items.forEach(item => {
    const id = String(item.product.id);
    for (let i = 1; i < data.length; i++) {
      if (String(data[i][idCol]) === id) {
        const current = parseFloat(data[i][stockCol]) || 0;
        sheet.getRange(i + 1, stockCol + 1).setValue(current - item.quantity);
        break;
      }
    }
  });
}

function saveProductToSheet(p) {
  const sheet = getSheetFlexible('Produtos');
  const data = sheet.getDataRange().getValues();
  const headers = data[0].map(h => normalizeHeader(h));
  const idIdx = headers.indexOf('id');
  
  let found = false;
  const targetId = String(p.id || "");
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][idIdx]) === targetId) {
      headers.forEach((h, j) => {
        if (p[h] !== undefined) sheet.getRange(i + 1, j + 1).setValue(p[h]);
      });
      found = true;
      break;
    }
  }
  if (!found) {
    const row = headers.map(h => p[h] || (h === 'id' ? (p.id || Utilities.getUuid()) : ""));
    sheet.appendRow(row);
  }
}

function deleteProductFromSheet(id) {
  const sheet = getSheetFlexible('Produtos');
  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][0]) === String(id)) {
      sheet.deleteRow(i + 1);
      break;
    }
  }
}

function deleteSaleFromSheet(id) {
  const sheet = getSheetFlexible('Vendas');
  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][0]) === String(id)) {
      sheet.deleteRow(i + 1);
      break;
    }
  }
}

function saveSettingsToSheet(s) {
  const sheet = getSheetFlexible('Config');
  sheet.getRange(2, 1, 1, 4).setValues([[s.businessName, s.cnpj, s.address, s.phone]]);
}

function deleteUserFromSheet(id) {
  const sheet = getSheetFlexible('Usuarios');
  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][0]) === String(id)) {
      sheet.deleteRow(i + 1);
      break;
    }
  }
}

function forgotPassword(email) {
  const users = getTableData('Usuarios');
  const user = users.find(u => String(u.email || u.e_mail || '').toLowerCase().trim() === String(email).toLowerCase().trim());
  if (!user) return sendResponse({ status: 'error', message: 'E-mail não encontrado.' });
  try {
    MailApp.sendEmail(email, "Sua Senha - PDV Blitz", `Sua senha é: ${user.password || user.senha}`);
    return sendResponse({ status: 'success', message: 'Senha enviada por e-mail.' });
  } catch (e) {
    return sendResponse({ status: 'error', message: 'Erro ao enviar e-mail: ' + e.message });
  }
}
