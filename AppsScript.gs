/**
 * Google Apps Script para o PDV Blitz e Dashboard Mobile
 * 
 * Configuração:
 * 1. Crie uma planilha no Google Sheets.
 * 2. Crie uma aba chamada "Produtos" com as colunas: id, name, purchasePrice, priceVarejo, priceAtacado, minAtacado, stock
 * 3. Crie uma aba chamada "Vendas" com as colunas: date, itemsResume, total, profit, paymentMethod, change
 * 4. Cole este código no Editor de Script (Extensões > Apps Script).
 * 5. Implante como Aplicativo Web (Qualquer pessoa pode acessar).
 */

const SS = SpreadsheetApp.getActiveSpreadsheet();

function doGet(e) {
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
      return sendResponse({ status: 'error', message: "Ação não reconhecida no backend (GET): " + action });
    }
    
    return ContentService.createTextOutput(JSON.stringify(result))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (error) {
    console.error("Erro detalhado no doGet:", error);
    return sendResponse({ 
      status: 'error', 
      message: "Falha crítica no Backend. Verifique se as abas 'Produtos', 'Vendas' e 'Usuarios' existem. Erro: " + error.toString(),
      stack: error.stack
    });
  }
}

function doPost(e) {
  try {
    const postData = JSON.parse(e.postData.contents);
    const action = postData.action;
    
    if (action === 'saveSale') {
      const sale = postData.saleData;
      saveSaleToSheet(sale);
      updateStock(sale.items);
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
    console.error("Erro detalhado no doPost:", error);
    return sendResponse({ 
      status: 'error', 
      message: "Falha ao processar requisição POST. Verifique as permissões do script. Erro: " + error.toString() 
    });
  }
}

function sendResponse(data) {
  return ContentService.createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

/**
 * Retorna os dados de uma aba como um array de objetos JSON
 */
function getTableData(sheetName) {
  const sheet = getSheetFlexible(sheetName);
  if (!sheet) return [];
  
  const data = sheet.getDataRange().getValues();
  if (data.length < 1) return [];
  
  const headers = data[0].map(h => {
    return h.toString()
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '_')
      .replace(/_+/g, '_')
      .replace(/^_|_$/g, '');
  });
  const rows = data.slice(1);
  
  return rows.map(row => {
    let obj = {};
    headers.forEach((header, i) => {
      if (header) obj[header] = row[i];
    });
    return obj;
  }).filter(item => {
    return item.id || item.date || item.data_hora || item.name || item.itemsresume;
  });
}

function getSheetFlexible(name) {
  const target = name.trim().toLowerCase();
  const sheets = SS.getSheets();
  for (let s of sheets) {
    if (s.getName().trim().toLowerCase() === target) return s;
  }
  return null;
}

function saveSaleToSheet(sale) {
  const sheet = getSheetFlexible('Vendas');
  if (!sheet) throw new Error("Aba 'Vendas' não encontrada!");
  
  const date = new Date().toLocaleString('pt-BR');
  const totalValue = parseFloat(String(sale.total).replace(',', '.')) || 0;
  const profitValue = parseFloat(String(sale.profit).replace(',', '.')) || 0;
  
  const data = sheet.getDataRange().getValues();
  const headers = data[0] || [];
  const headersLower = headers.map(h => h.toString().trim().toLowerCase());
  
  let idIndex = headersLower.indexOf('id');
  if (idIndex === -1) {
    sheet.insertColumnBefore(1);
    sheet.getRange(1, 1).setValue('id');
    SpreadsheetApp.flush();
    idIndex = 0;
  }

  // Verificar coluna vendedor
  const updatedHeaders = sheet.getDataRange().getValues()[0];
  if (updatedHeaders.indexOf('vendedor') === -1) {
    sheet.getRange(1, updatedHeaders.length + 1).setValue('vendedor');
  }
  
  const lastRow = sheet.getLastRow();
  const range = sheet.getRange(lastRow + 1, 1, 1, 8);
  range.setValues([[
    sale.id || Utilities.getUuid(),
    date,
    sale.itemsResume || "Venda sem descrição",
    totalValue,
    profitValue,
    sale.paymentMethod || "N/A",
    sale.change || 0,
    sale.user || "Balcão"
  ]]);
}

function deleteSaleFromSheet(saleId) {
  const sheet = getSheetFlexible('Vendas');
  if (!sheet) return;
  const data = sheet.getDataRange().getValues();
  const headers = data[0].map(h => h.toString().trim().toLowerCase());
  const idColIndex = headers.indexOf('id');
  
  if (idColIndex === -1) return;

  const idToFind = String(saleId).trim();
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][idColIndex]).trim() === idToFind) {
      sheet.deleteRow(i + 1);
      return;
    }
  }
}

function editSaleInSheet(sale) {
  const sheet = getSheetFlexible('Vendas');
  if (!sheet) return;
  const data = sheet.getDataRange().getValues();
  const headers = data[0].map(h => h.toString().trim().toLowerCase());
  const idColIndex = headers.indexOf('id');
  
  if (idColIndex === -1) return;

  const idToFind = String(sale.id).trim();
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][idColIndex]).trim() === idToFind) {
      const totalCol = headers.indexOf('total') + 1;
      const profitCol = headers.indexOf('profit') + 1;
      const methodCol = headers.indexOf('paymentmethod') + 1;

      if (totalCol > 0) sheet.getRange(i + 1, totalCol).setValue(parseFloat(String(sale.total).replace(',', '.')) || 0);
      if (profitCol > 0) sheet.getRange(i + 1, profitCol).setValue(parseFloat(String(sale.profit).replace(',', '.')) || 0);
      if (methodCol > 0) sheet.getRange(i + 1, methodCol).setValue(sale.paymentMethod);
      return;
    }
  }
}

function updateStock(items) {
  const sheet = getSheetFlexible('Produtos');
  if (!sheet) return;
  
  const data = sheet.getDataRange().getValues();
  const headers = data[0].map(h => h.toString().trim().toLowerCase());
  const idCol = headers.indexOf('id');
  const stockCol = headers.indexOf('stock');

  if (idCol === -1 || stockCol === -1) return;

  items.forEach(item => {
    const productId = String(item.product.id || item.product.ID);
    const quantity = parseInt(item.quantity);
    
    for (let i = 1; i < data.length; i++) {
      if (String(data[i][idCol]) === productId) {
        const currentStock = parseFloat(data[i][stockCol]) || 0;
        sheet.getRange(i + 1, stockCol + 1).setValue(currentStock - quantity);
        break;
      }
    }
  });
}

function saveProductToSheet(product) {
  const sheet = getSheetFlexible('Produtos');
  if (!sheet) throw new Error("Aba 'Produtos' não encontrada!");
  
  const data = sheet.getDataRange().getValues();
  const headers = data[0].map(h => h.toString().trim().toLowerCase());
  
  const idColIdx = headers.indexOf('id');
  const nameColIdx = headers.indexOf('name');
  const purchasePriceColIdx = headers.indexOf('purchaseprice');
  const priceVarejoColIdx = headers.indexOf('pricevarejo');
  const priceAtacadoColIdx = headers.indexOf('priceatacado');
  const minAtacadoColIdx = headers.indexOf('minatacado');
  const stockColIdx = headers.indexOf('stock');

  if (idColIdx === -1) throw new Error("Coluna 'id' não encontrada em Produtos");

  let found = false;
  const productId = String(product.id || "");
  
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][idColIdx]) === productId) {
      if (nameColIdx !== -1) sheet.getRange(i + 1, nameColIdx + 1).setValue(product.name);
      if (purchasePriceColIdx !== -1) sheet.getRange(i + 1, purchasePriceColIdx + 1).setValue(product.purchasePrice || 0);
      if (priceVarejoColIdx !== -1) sheet.getRange(i + 1, priceVarejoColIdx + 1).setValue(product.priceVarejo || 0);
      if (priceAtacadoColIdx !== -1) sheet.getRange(i + 1, priceAtacadoColIdx + 1).setValue(product.priceAtacado || 0);
      if (minAtacadoColIdx !== -1) sheet.getRange(i + 1, minAtacadoColIdx + 1).setValue(product.minAtacado || 0);
      if (stockColIdx !== -1) sheet.getRange(i + 1, stockColIdx + 1).setValue(product.stock || 0);
      found = true;
      break;
    }
  }

  if (!found) {
    const newRow = new Array(headers.length).fill("");
    if (idColIdx !== -1) newRow[idColIdx] = product.id || Utilities.getUuid();
    if (nameColIdx !== -1) newRow[nameColIdx] = product.name;
    if (purchasePriceColIdx !== -1) newRow[purchasePriceColIdx] = product.purchasePrice || 0;
    if (priceVarejoColIdx !== -1) newRow[priceVarejoColIdx] = product.priceVarejo;
    if (priceAtacadoColIdx !== -1) newRow[priceAtacadoColIdx] = product.priceAtacado;
    if (minAtacadoColIdx !== -1) newRow[minAtacadoColIdx] = product.minAtacado;
    if (stockColIdx !== -1) newRow[stockColIdx] = product.stock;
    sheet.appendRow(newRow);
  }
}

function deleteProductFromSheet(productId) {
  const sheet = getSheetFlexible('Produtos');
  if (!sheet) return;
  const data = sheet.getDataRange().getValues();
  const headers = data[0].map(h => h.toString().trim().toLowerCase());
  const idColIdx = headers.indexOf('id');
  
  if (idColIdx === -1) return;

  const idToFind = String(productId).trim();
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][idColIdx]).trim() === idToFind) {
      sheet.deleteRow(i + 1);
      break;
    }
  }
}

function saveSettingsToSheet(settings) {
  let sheet = getSheetFlexible('Config');
  if (!sheet) {
    sheet = SS.insertSheet('Config');
    sheet.appendRow(['businessName', 'cnpj', 'address', 'phone']);
  }
  
  const headers = ['businessName', 'cnpj', 'address', 'phone'];
  const rowData = headers.map(h => settings[h] || "");
  
  if (sheet.getLastRow() > 1) {
    sheet.getRange(2, 1, 1, headers.length).setValues([rowData]);
  } else {
    sheet.appendRow(rowData);
  }
}

function saveUserToSheet(user) {
  let sheet = getSheetFlexible('Usuarios');
  if (!sheet) {
    sheet = SS.insertSheet('Usuarios');
    sheet.appendRow(['id', 'name', 'role', 'status', 'email', 'password']);
  }
  
  const data = sheet.getDataRange().getValues();
  const headers = data[0].map(h => h.toString().toLowerCase().trim());
  
  const emailIdx = headers.indexOf('email');
  const passIdx = headers.indexOf('password');
  const nameIdx = headers.indexOf('name');
  const roleIdx = headers.indexOf('role');
  const statusIdx = headers.indexOf('status');

  let found = false;
  const rowId = user.id || Utilities.getUuid();
  
  for (let i = 1; i < data.length; i++) {
    if (data[i][0] == rowId) {
      if (nameIdx !== -1 && user.name) sheet.getRange(i + 1, nameIdx + 1).setValue(user.name);
      if (roleIdx !== -1 && user.role) sheet.getRange(i + 1, roleIdx + 1).setValue(user.role);
      if (statusIdx !== -1 && user.status) sheet.getRange(i + 1, statusIdx + 1).setValue(user.status);
      if (emailIdx !== -1 && user.email) sheet.getRange(i + 1, emailIdx + 1).setValue(user.email);
      if (passIdx !== -1 && user.password) sheet.getRange(i + 1, passIdx + 1).setValue(user.password);
      found = true;
      break;
    }
  }

  if (!found) {
    const newRow = new Array(headers.length).fill("");
    newRow[0] = rowId;
    if (nameIdx !== -1) newRow[nameIdx] = user.name || "";
    if (roleIdx !== -1) newRow[roleIdx] = user.role || "Operador";
    if (statusIdx !== -1) newRow[statusIdx] = user.status || "Ativo";
    if (emailIdx !== -1) newRow[emailIdx] = user.email || "";
    if (passIdx !== -1) newRow[passIdx] = user.password || "";
    sheet.appendRow(newRow);
  }
}

function registerUser(userData) {
  const users = getTableData('Usuarios');
  if (users.some(u => (u.email || '').toLowerCase() === (userData.email || '').toLowerCase())) {
    return sendResponse({ status: 'error', message: 'E-mail já cadastrado' });
  }
  saveUserToSheet(userData);
  return sendResponse({ status: 'success' });
}

function loginUser(email, password) {
  const users = getTableData('Usuarios');
  const user = users.find(u => (u.email || '').toLowerCase() === email.toLowerCase() && String(u.password) === String(password));
  
  if (user) {
    if (user.status === 'Inativo') {
      return sendResponse({ status: 'error', message: 'Usuário inativo. Contacte o administrador.' });
    }
    delete user.password;
    return sendResponse({ status: 'success', user: user });
  }
  return sendResponse({ status: 'error', message: 'E-mail ou senha incorretos' });
}

function forgotPassword(email) {
  const users = getTableData('Usuarios');
  const user = users.find(u => (u.email || '').toLowerCase() === (email || '').toLowerCase());
  
  if (!user) return sendResponse({ status: 'error', message: 'E-mail não encontrado' });
  
  try {
    const subject = "Recuperação de Senha - PDV Blitz";
    const body = `Olá ${user.name},\n\nSua senha para acesso ao sistema PDV Blitz é: ${user.password}\n\nRecomendamos trocar sua senha após o acesso.`;
    MailApp.sendEmail(email, subject, body);
    return sendResponse({ status: 'success', message: 'E-mail enviado com sucesso' });
  } catch (e) {
    return sendResponse({ status: 'error', message: 'Erro ao enviar e-mail: ' + e.message });
  }
}

function deleteUserFromSheet(userId) {
  const sheet = getSheetFlexible('Usuarios');
  if (!sheet) return;
  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (data[i][0] == userId) {
      sheet.deleteRow(i + 1);
      break;
    }
  }
}
