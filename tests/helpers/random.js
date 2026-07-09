function email() {
    return `teste_${Date.now()}_${Math.floor(Math.random() * 10000)}@teste.com`;
}

function whatsapp() {
    return `6299${Math.floor(10000000 + Math.random() * 89999999)}`;
}

module.exports = {
    email,
    whatsapp
};