const bcrypt = require("bcryptjs");
const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

const hashPassword = async (plain) => {
  const saltRounds = 10;
  return bcrypt.hash(plain, saltRounds);
};

async function upsertOperatorUser({ username, passwordPlain, userType, department }) {
  const password = await hashPassword(passwordPlain);

  if (userType === "ADMIN") {
    return prisma.user.upsert({
      where: { username },
      update: {
        password,
        active: true,
        userType,
        adminProfile: {
          upsert: {
            update: { department },
            create: { department },
          },
        },
      },
      create: {
        username,
        password,
        active: true,
        userType,
        adminProfile: { create: { department } },
      },
      include: { adminProfile: true },
    });
  }

  // AGENT
  return prisma.user.upsert({
    where: { username },
    update: {
      password,
      active: true,
      userType,
      agentProfile: {
        upsert: {
          update: { department, active: true },
          create: { department, active: true },
        },
      },
    },
    create: {
      username,
      password,
      active: true,
      userType,
      agentProfile: { create: { department, active: true, adminId: null } },
    },
    include: { agentProfile: true },
  });
}

async function upsertEndUser({ username, passwordPlain }) {
  const password = await hashPassword(passwordPlain);

  return prisma.endUser.upsert({
    where: { username },
    update: { password, active: true },
    create: { username, password, active: true },
  });
}

async function main() {
  // 20 users (operator/admin/agent) + 2 end-users as sample
  const users = [
    { username: "admin", password: "admin", userType: "ADMIN", department: "PRICE" },
    { username: "price_admin", password: "password123", userType: "ADMIN", department: "PRICE" },
    { username: "invest_admin", password: "password123", userType: "ADMIN", department: "INVESTMENT" },
    { username: "product_admin", password: "password123", userType: "ADMIN", department: "PRODUCT" },
    { username: "sell_admin", password: "password123", userType: "ADMIN", department: "SELL" },

    { username: "operator_price", password: "operator123", userType: "AGENT", department: "PRICE" },
    { username: "operator_sell", password: "operator123", userType: "AGENT", department: "SELL" },
    { username: "operator_product", password: "operator123", userType: "AGENT", department: "PRODUCT" },
    { username: "operator_investment", password: "operator123", userType: "AGENT", department: "INVESTMENT" },
    { username: "operator", password: "operator123", userType: "AGENT", department: "PRICE" },

    { username: "agent1", password: "agent123", userType: "AGENT", department: "PRICE" },
    { username: "agent2", password: "agent123", userType: "AGENT", department: "PRODUCT" },
    { username: "agent3", password: "agent123", userType: "AGENT", department: "SELL" },
    { username: "agent4", password: "agent123", userType: "AGENT", department: "INVESTMENT" },

    // extra operator users to make total operator/admin/agent count = 20
    { username: "op5", password: "operator123", userType: "AGENT", department: "PRICE" },
    { username: "op6", password: "operator123", userType: "AGENT", department: "PRODUCT" },
    { username: "op7", password: "operator123", userType: "AGENT", department: "SELL" },
    { username: "op8", password: "operator123", userType: "AGENT", department: "INVESTMENT" },
    { username: "admin2", password: "password123", userType: "ADMIN", department: "PRICE" },
    { username: "admin3", password: "password123", userType: "ADMIN", department: "INVESTMENT" },
  ];

  const endUsers = [
    { username: "user1", password: "user123" },
    { username: "user2", password: "user123" },
  ];

  console.log("SEED_USERS: operator users upsert started");
  for (const u of users) {
    await upsertOperatorUser({
      username: u.username,
      passwordPlain: u.password,
      userType: u.userType,
      department: u.department,
    });
    console.log("SEED_USERS: upserted", u.username);
  }

  console.log("SEED_USERS: end users upsert started");
  for (const eu of endUsers) {
    await upsertEndUser({ username: eu.username, passwordPlain: eu.password });
    console.log("SEED_USERS: upserted", eu.username);
  }

  console.log("SEED_USERS: done");
}

main()
  .catch((e) => {
    console.error("SEED_USERS: failed", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect().catch(() => {});
  });
