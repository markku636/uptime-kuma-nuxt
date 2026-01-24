// Create admin user script
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

async function createAdminUser() {
  const prisma = new PrismaClient();
  
  const ADMIN_USERNAME = 'admin';
  const ADMIN_PASSWORD = 'admin123';
  
  try {
    // Check if admin user already exists
    const existingUser = await prisma.user.findUnique({
      where: { username: ADMIN_USERNAME }
    });
    
    if (existingUser) {
      console.log('Admin user already exists, updating password...');
      const hashedPassword = await bcrypt.hash(ADMIN_PASSWORD, 10);
      await prisma.user.update({
        where: { username: ADMIN_USERNAME },
        data: { password: hashedPassword }
      });
      console.log('Password updated!');
    } else {
      console.log('Creating new admin user...');
      const hashedPassword = await bcrypt.hash(ADMIN_PASSWORD, 10);
      await prisma.user.create({
        data: {
          username: ADMIN_USERNAME,
          password: hashedPassword,
          active: true
        }
      });
      console.log('Admin user created!');
    }
    
    console.log('');
    console.log('Admin Credentials:');
    console.log('  Username:', ADMIN_USERNAME);
    console.log('  Password:', ADMIN_PASSWORD);
    
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

createAdminUser();
