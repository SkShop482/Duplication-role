require('dotenv').config();
const { Client, GatewayIntentBits, SlashCommandBuilder, REST, Routes, PermissionFlagsBits } = require('discord.js');

const TOKEN = process.env.DISCORD_TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

// Enregistrement de la commande slash
const commands = [
  new SlashCommandBuilder()
    .setName('copier_role')
    .setDescription('Duplique un rôle avec ses permissions')
    .addRoleOption(option =>
      option.setName('role')
        .setDescription('Le rôle à copier')
        .setRequired(true))
    .addStringOption(option =>
      option.setName('nouveau_nom')
        .setDescription('Nom du nouveau rôle (optionnel, sinon "Copie de <nom>")')
        .setRequired(false))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles)
    .toJSON()
];

async function registerCommands(guildId) {
  const rest = new REST({ version: '10' }).setToken(TOKEN);
  try {
    await rest.put(
      Routes.applicationGuildCommands(CLIENT_ID, guildId),
      { body: commands }
    );
    console.log(`✅ Commande enregistrée sur le serveur ${guildId}`);
  } catch (err) {
    console.error('Erreur enregistrement commande:', err);
  }
}

client.once('ready', async () => {
  console.log(`🤖 Connecté en tant que ${client.user.tag}`);
  for (const [, guild] of client.guilds.cache) {
    await registerCommands(guild.id);
  }
});

client.on('guildCreate', async (guild) => {
  await registerCommands(guild.id);
});

client.on('interactionCreate', async (interaction) => {
  if (!interaction.isChatInputCommand()) return;
  if (interaction.commandName !== 'copier_role') return;

  await interaction.deferReply({ ephemeral: true });

  const roleSource = interaction.options.getRole('role');
  const nouveauNom = interaction.options.getString('nouveau_nom') || `${roleSource.name} (1)`;

  // Vérif que le bot peut gérer des rôles
  const botMember = interaction.guild.members.me;
  if (!botMember.permissions.has(PermissionFlagsBits.ManageRoles)) {
    return interaction.editReply('❌ Je n\'ai pas la permission de gérer les rôles.');
  }

  // Vérif que le rôle source est en dessous du bot dans la hiérarchie
  if (roleSource.position >= botMember.roles.highest.position) {
    return interaction.editReply('❌ Ce rôle est au-dessus de moi dans la hiérarchie, je ne peux pas le copier.');
  }

  try {
    const nouveauRole = await interaction.guild.roles.create({
      name: nouveauNom,
      color: roleSource.color,
      permissions: roleSource.permissions,
      hoist: roleSource.hoist,           // affiché séparément dans la liste des membres
      mentionable: roleSource.mentionable,
      reason: `Copie du rôle ${roleSource.name} par ${interaction.user.tag}`
    });

    // Liste des permissions actives pour l'affichage
    const permsActives = roleSource.permissions.toArray();
    const permsTexte = permsActives.length > 0
      ? permsActives.map(p => `\`${p}\``).join(', ')
      : 'Aucune permission';

    await interaction.editReply(
      `✅ Rôle **${nouveauRole.name}** créé avec succès !\n` +
      `🎨 Couleur : \`${roleSource.hexColor}\`\n` +
      `🔐 Permissions copiées : ${permsTexte}`
    );
  } catch (err) {
    console.error('Erreur création rôle:', err);
    await interaction.editReply(`❌ Erreur lors de la création du rôle : \`${err.message}\``);
  }
});

client.login(TOKEN);
