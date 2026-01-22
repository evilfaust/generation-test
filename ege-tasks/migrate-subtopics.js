import PocketBase from 'pocketbase';

const pb = new PocketBase('http://127.0.0.1:8090');

async function migrateSubtopics() {
  try {
    console.log('Начинаем миграцию подтем...\n');

    // Получаем все темы с подтемами
    const topics = await pb.collection('topics').getFullList({
      fields: 'id,name,subtopic'
    });

    console.log(`Найдено тем: ${topics.length}\n`);

    let migratedCount = 0;
    let order = 1;

    for (const topic of topics) {
      if (topic.subtopic && topic.subtopic.trim() !== '') {
        console.log(`Тема: ${topic.name} (${topic.id})`);
        console.log(`  Подтема: ${topic.subtopic}`);

        // Проверяем, не существует ли уже такая подтема для этой темы
        const existing = await pb.collection('subtopics').getFullList({
          filter: `name = "${topic.subtopic}" && topic = "${topic.id}"`
        });

        if (existing.length === 0) {
          // Создаем новую запись в subtopics
          const subtopic = await pb.collection('subtopics').create({
            name: topic.subtopic,
            topic: topic.id,
            order: order++
          });

          console.log(`  ✓ Создана подтема с id: ${subtopic.id}\n`);
          migratedCount++;
        } else {
          console.log(`  ⊘ Подтема уже существует\n`);
        }
      }
    }

    console.log(`\nМиграция завершена!`);
    console.log(`Создано подтем: ${migratedCount}`);

  } catch (error) {
    console.error('Ошибка при миграции:', error);
  }
}

migrateSubtopics();
