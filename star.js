const { Client, Util } = require("discord.js");
const { PREFIX } = require(`./config`);
const ytdl = require("ytdl-core");

const client = new Client({ disableEveryone: true });

const queue = new Map();

client.on('warn', console.warn);

client.on('error', console.error);

client.on('ready', () => console.log('Ready for music~'));

client.on('disconnect', () => console.log('Disconnected! Will reconnect now...'));

client.on('reconnecting', () => console.log('Reconnecting now!'));

client.on('message', async message => {
    if (message.author.bot) return;
    if (!message.content.startsWith(PREFIX)) return;
    const args = message.content.split(' ');
    const serverQueue = queue.get(message.guild.id);

    if (message.content.startsWith(`${PREFIX}play`)) {
        const voiceChannel = message.member.voiceChannel;
        if (!voiceChannel) return message.channel.send("Please join a voice channel to use this!");
        if (!args[1]) return message.channel.send('Please link a song!');
        const permissions = voiceChannel.permissionsFor(message.client.user);
        if (!permissions.has('CONNECT')) {
            return message.channel.send("I can't connect!'");
        }
        if (!permissions.has('SPEAK')) {
            return message.channel.send("I can't speak in this channel!");
        }

        const songInfo = await ytdl.getInfo(args[1]);
        const song = {
            title: Util.escapeMarkdown(songInfo.title),
            url: songInfo.video_url
        };
        if (!serverQueue) {
            const queueConstruct = {
                textChannel: message.channel,
                voiceChannel: voiceChannel,
                connection: null,
                songs: [],
                volume: 5,
                playing: true
            };
            queue.set(message.guild.id, queueConstruct);

            queueConstruct.songs.push(song);

            try {
                //message.channel.send("Joining voice channel!");
                var connection = await voiceChannel.join();
                queueConstruct.connection = connection;
                play(message.guild, queueConstruct.songs[0]);
            } catch (error) {
                console.error(`I couldn't join the voice channel: ${error}`);
                queue.delete();
                return message.channel.send(`I couldn't join the voice channel: ${error}`);
            }
        } else {
            serverQueue.songs.push(song);
            return message.channel.send(`**${song.title}** has been added to the queue!`)
        }

    } else if (message.content.startsWith(`${PREFIX}skip`)) {
        if (!message.member.voiceChannel) return message.channel.send("You must be in a voice channel!");
        if (!serverQueue) return message.channel.send("No songs to skip!");
        serverQueue.connection.dispatcher.end();
        return;
    } else if (message.content.startsWith(`${PREFIX}stop`) || message.content.startsWith(`${PREFIX}disconnect`)) {
        if (!message.member.voiceChannel) return message.channel.send("You must be in a voice channel!");
        if (!serverQueue) return message.channel.send("No songs to stop!");
        message.channel.send("Stopping the player!");
        serverQueue.songs = [];
        serverQueue.connection.dispatcher.end();
        return;
    } else if (message.content.startsWith(`${PREFIX}volume`) || message.content.startsWith(`${PREFIX}vol`)) {
        if (!message.member.voiceChannel) return message.channel.send("You must be in a voice channel!");
        if (!serverQueue) return message.channel.send("Nothing currently playing.");
        if (!args[1]) return message.channel.send(`Current volume is **${serverQueue.volume}**.`);
        serverQueue.volume = args[1];
        serverQueue.connection.dispatcher.setVolumeLogarithmic(args[1] / 5);
        return message.channel.send(`Set the volume to **${args[1]}**!`);
    } else if (message.content.startsWith(`${PREFIX}np`)) {
        if (!serverQueue) return message.channel.send("Nothing currently playing.");
        return message.channel.send(`Now Playing: **${serverQueue.songs[0].title}**`);
    } else if (message.content.startsWith(`${PREFIX}q`) || message.content.startsWith(`${PREFIX}queue`)) {
        if (!serverQueue) return message.channel.send("Nothing currently playing.");
        return message.channel.send(`
__**Song Queue**__
${serverQueue.songs.map(song => `**-** ${song.title}`).join(`\n`)}

**Now Playing:** ${serverQueue.songs[0].title}
        `);
    } else if (message.content.startsWith(`${PREFIX}pause`)) {
        if (serverQueue && serverQueue.playing) {
            serverQueue.playing = false;
            serverQueue.connection.dispatcher.pause();
            return message.channel.send(`The player has been paused! Use ${PREFIX}resume to resume playing`);
        }
        return message.channel.send("Nothing currently playing.");
    } else if (message.content.startsWith(`${PREFIX}resume`)) {
        if (serverQueue && !serverQueue.playing) {
            serverQueue.playing = true;
            serverQueue.connection.dispatcher.resume();
            return message.channel.send("Resumed the music player!");
        }
        return message.channel.send("The player isn't paused!");
    } 
    return;
});

function play(guild, song) {
    const serverQueue = queue.get(guild.id);

    if (!song) {
        serverQueue.voiceChannel.leave();
        queue.delete(guild.id);
        return;
    }
    console.log(serverQueue.songs);

    const dispatcher = serverQueue.connection.playStream(ytdl(song.url))        
        .on('end', reason => {
            //console.log('song ended!');
            serverQueue.songs.shift();
            play(guild, serverQueue.songs[0]);
        })
        .on('error', error => console.error(error));
    dispatcher.setVolumeLogarithmic(serverQueue.volume / 5);

    serverQueue.textChannel.send(`Playing **${song.title}**`);
}

client.login(TOKEN);
