// prisma/seed.ts
// Corre com: npm run seed   (script: "tsx prisma/seed.ts")
import "dotenv/config";
import { faker } from "@faker-js/faker";
import bcrypt from "bcryptjs";
import { prisma } from "../src/lib/prisma.js";

// ---- configuração ---------------------------------------------------------
const USER_COUNT = 12;
const PASSWORD = "password123"; // igual para todos, para poderes fazer login
const MAX_POSTS_PER_USER = 5;
const MAX_IMAGES_PER_POST = 3;
const MAX_COMMENTS_PER_POST = 4;

// ---- helpers --------------------------------------------------------------
const randInt = (min: number, max: number) =>
    faker.number.int({ min, max });

const randomImage = (w: number, h: number) =>
    `https://picsum.photos/seed/${faker.string.alphanumeric(10)}/${w}/${h}`;

async function main() {
    if (process.env.NODE_ENV === "production") {
        throw new Error("O seed apaga todos os dados. Não corras em produção.");
    }

    // 1. Limpar (filhos antes dos pais, por causa das foreign keys)
    await prisma.like.deleteMany();
    await prisma.comment.deleteMany();
    await prisma.postImage.deleteMany();
    await prisma.post.deleteMany();
    await prisma.follow.deleteMany();
    await prisma.user.deleteMany();

    const passwordHash = await bcrypt.hash(PASSWORD, 10);

    // 2. Utilizadores (o primeiro é um utilizador "demo" para login rápido)
    const users = [];
    for (let i = 0; i < USER_COUNT; i++) {
        const isDemo = i === 0;
        const first = faker.person.firstName().toLowerCase();
        const last = faker.person.lastName().toLowerCase();
        const username = isDemo ? "demo" : `${first}.${last}${i}`;

        users.push(
            await prisma.user.create({
                data: {
                    username,
                    email: isDemo ? "demo@odinbook.dev" : `${username}@example.com`,
                    password: passwordHash,
                    bio: faker.lorem.sentence(),
                    avatarUrl: faker.image.avatar(),
                    coverUrl: randomImage(1200, 400),
                    // avatarPublicId / coverPublicId ficam null: não existem no Cloudinary
                },
            })
        );
    }

    // 3. Posts (com 0..N imagens; todo o post tem texto ou pelo menos 1 imagem)
    const posts = [];
    for (const user of users) {
        const count = randInt(1, MAX_POSTS_PER_USER);
        for (let i = 0; i < count; i++) {
            const hasText = faker.datatype.boolean(0.85);
            let imageCount = faker.datatype.boolean(0.5)
                ? randInt(1, MAX_IMAGES_PER_POST)
                : 0;
            if (!hasText && imageCount === 0) imageCount = 1;

            posts.push(
                await prisma.post.create({
                    data: {
                        content: hasText ? faker.lorem.paragraph() : null,
                        authorId: user.id,
                        createdAt: faker.date.recent({ days: 30 }),
                        images: {
                            create: Array.from({ length: imageCount }, (_, position) => ({
                                url: randomImage(800, 600),
                                position,
                            })),
                        },
                    },
                })
            );
        }
    }

    // 4. Comentários
    let commentTotal = 0;
    for (const post of posts) {
        const n = randInt(0, MAX_COMMENTS_PER_POST);
        for (let i = 0; i < n; i++) {
            const author = faker.helpers.arrayElement(users);
            await prisma.comment.create({
                data: {
                    content: faker.lorem.sentence(),
                    authorId: author.id,
                    postId: post.id,
                    createdAt: faker.date.between({
                        from: post.createdAt,
                        to: new Date(),
                    }),
                },
            });
            commentTotal++;
        }
    }

    // 5. Likes (arrayElements devolve elementos únicos -> sem duplicados)
    let likeTotal = 0;
    for (const post of posts) {
        const likers = faker.helpers.arrayElements(
            users,
            randInt(0, users.length)
        );
        const result = await prisma.like.createMany({
            data: likers.map((u) => ({ userId: u.id, postId: post.id })),
            skipDuplicates: true,
        });
        likeTotal += result.count;
    }

    // 6. Follows (sem auto-follow, sem pares repetidos, estados misturados)
    const seen = new Set<string>();
    const follows: {
        followerId: number;
        followingId: number;
        status: "PENDING" | "ACCEPTED";
    }[] = [];

    const addFollow = (
        followerId: number,
        followingId: number,
        status: "PENDING" | "ACCEPTED"
    ) => {
        const key = `${followerId}-${followingId}`;
        if (followerId === followingId || seen.has(key)) return;
        seen.add(key);
        follows.push({ followerId, followingId, status });
    };

    const demo = users[0];

    // O demo segue 5 pessoas (aceites), para o feed ter conteúdo
    for (const other of faker.helpers.arrayElements(users.slice(1), 5)) {
        addFollow(demo.id, other.id, "ACCEPTED");
    }
    // Alguns pedidos pendentes a chegar ao demo, para testares aceitar/recusar
    for (const other of faker.helpers.arrayElements(users.slice(1), 3)) {
        addFollow(other.id, demo.id, "PENDING");
    }
    // Os restantes seguem pessoas ao acaso
    for (const user of users.slice(1)) {
        const targets = faker.helpers.arrayElements(
            users.filter((u) => u.id !== user.id),
            randInt(2, 6)
        );
        for (const t of targets) {
            addFollow(
                user.id,
                t.id,
                faker.datatype.boolean(0.75) ? "ACCEPTED" : "PENDING"
            );
        }
    }

    await prisma.follow.createMany({ data: follows, skipDuplicates: true });

    console.log("Seed concluído:");
    console.log(`  utilizadores: ${users.length}`);
    console.log(`  posts:        ${posts.length}`);
    console.log(`  comentários:  ${commentTotal}`);
    console.log(`  likes:        ${likeTotal}`);
    console.log(`  follows:      ${follows.length}`);
    console.log(`Login de teste: demo@odinbook.dev / ${PASSWORD}`);
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });