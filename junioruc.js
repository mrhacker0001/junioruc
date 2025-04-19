const TelegramBot = require('node-telegram-bot-api');
const admin = require("firebase-admin");
require('dotenv').config();

const serviceAccount = JSON.parse(Buffer.from(process.env.FIREBASE_SERVICE_ACCOUNT, 'base64').toString('utf-8'));

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
});
const db = admin.firestore();
const bot = new TelegramBot(process.env.TELEGRAM_BOT_TOKEN, { polling: true });

const ucOptions = [
    { amount: 60, price: 6000 },
    { amount: 325, price: 30000 },
    { amount: 660, price: 60000 },
];

// Adminlar ro'yxati
const adminIds = ['8027352397'];

// Admin paneli uchun button
bot.onText(/\/adminPanel/, async (msg) => {
    const chatId = msg.chat.id;

    if (!adminIds.includes(chatId.toString())) {
        return bot.sendMessage(chatId, 'Sizda admin panelini ko‘rish huquqi yo‘q.');
    }

    // Foydalanuvchilar sonini olish
    const usersSnapshot = await db.collection('users').get();
    const userCount = usersSnapshot.size;

    const message = `Admin Panel:\n\nFoydalanuvchilar soni: ${userCount}`;

    bot.sendMessage(chatId, message);
});

const targetGroupId = '-1001234567890'; // Adminlar guruhi ID sini shu yerga yozing

const userSessions = {};

bot.onText(/\/start/, (msg) => {
    const chatId = msg.chat.id;
    const opts = {
        reply_markup: {
            inline_keyboard: [
                [{ text: '🛒 UC sotib olish', callback_data: 'buy_uc' }]
            ]
        }
    };
    bot.sendMessage(chatId, "Assalomu alaykum! UC xizmatimizga xush kelibsiz.", opts);
});

bot.on('callback_query', async (query) => {
    const chatId = query.message.chat.id;
    const data = query.data;

    if (data === 'buy_uc') {
        const buttons = ucOptions.map(uc => [
            {
                text: `${uc.amount} UC - ${uc.price.toLocaleString()} so'm`,
                callback_data: `uc_${uc.amount}`
            }
        ]);
        bot.sendMessage(chatId, "Kerakli UC miqdorini tanlang:", {
            reply_markup: { inline_keyboard: buttons }
        });
    }

    if (data.startsWith('uc_')) {
        const selectedUC = parseInt(data.split('_')[1]);
        const selected = ucOptions.find(u => u.amount === selectedUC);
        userSessions[chatId] = { uc: selectedUC, price: selected.price };
        bot.sendMessage(chatId, `✅ ${selectedUC} UC tanlandi. Narxi: ${selected.price} so'm\n\nPUBG ID raqamingizni yuboring:`);
    }
});

bot.on('message', async (msg) => {
    const chatId = msg.chat.id;

    if (msg.text && userSessions[chatId] && !userSessions[chatId].pubgId) {
        userSessions[chatId].pubgId = msg.text;
        bot.sendMessage(chatId, "📱 Telefon raqamingizni yuboring:");
    }

    if (msg.text && userSessions[chatId] && userSessions[chatId].pubgId && !userSessions[chatId].phoneNumber) {
        userSessions[chatId].phoneNumber = msg.text;
        bot.sendMessage(chatId, "🖼️ To‘lov chekingizni yuboring:");
    }

    if (msg.photo && userSessions[chatId]?.pubgId && userSessions[chatId]?.phoneNumber) {
        const photoId = msg.photo[msg.photo.length - 1].file_id;
        const session = userSessions[chatId];

        const userName = msg.from.username || 'No Username';

        const userData = {
            chatId,
            userName,
            pubgId: session.pubgId,
            phoneNumber: session.phoneNumber,
            ucAmount: session.uc,
            ucPrice: session.price
        };

        // Foydalanuvchidan cheque rasmni olish va adminlarga yuborish
        const caption = `🛒 Yangi buyurtma:\n\n👤 Foydalanuvchi: ${userData.userName}\n🎮 PUBG ID: ${userData.pubgId}\n📱 Telefon raqami: ${userData.phoneNumber}\n💰 UC miqdori: ${userData.ucAmount} UC\n💵 Narxi: ${userData.ucPrice} so'm`;

        await bot.sendPhoto(targetGroupId, photoId, { caption });

        // Adminlar guruhiga ma'lumotlarni yuborish
        bot.sendMessage(targetGroupId, `🛒 Yangi buyurtma:\n\n👤 Foydalanuvchi: ${userData.userName}\n🎮 PUBG ID: ${userData.pubgId}\n📱 Telefon raqami: ${userData.phoneNumber}\n💰 UC miqdori: ${userData.ucAmount} UC\n💵 Narxi: ${userData.ucPrice} so'm`);

        bot.sendMessage(chatId, "✅ Buyurtma qabul qilindi. Tez orada UC qo‘shiladi.");

        // Sessionni o'chirish
        delete userSessions[chatId];
    }
});
