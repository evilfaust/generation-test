import PocketBase from 'pocketbase';

const pb = new PocketBase('http://127.0.0.1:8090');

async function updateSubtopicsArray() {
  try {
    console.log('Обновляем задачи для связи с подтемами...\n');

    // Получаем все подтемы
    const subtopics = await pb.collection('subtopics').getFullList({
      expand: 'topic'
    });

    console.log(`Найдено подтем: ${subtopics.length}\n`);

    for (const subtopic of subtopics) {
      console.log(`Подтема: "${subtopic.name}"`);
      console.log(`  ID подтемы: ${subtopic.id}`);
      console.log(`  ID темы: ${subtopic.topic}`);

      // Получаем все задачи этой темы
      const allTasks = await pb.collection('tasks').getFullList({
        filter: `topic = "${subtopic.topic}"`,
        fields: 'id,code,subtopic'
      });

      console.log(`  Всего задач: ${allTasks.length}`);

      // Фильтруем задачи с пустым массивом subtopic
      const tasksToUpdate = allTasks.filter(t => {
        return Array.isArray(t.subtopic) && t.subtopic.length === 0;
      });

      console.log(`  Задач с пустым subtopic[]: ${tasksToUpdate.length}`);

      if (tasksToUpdate.length > 0) {
        console.log(`  Обновляем...`);
        let updated = 0;
        for (const task of tasksToUpdate) {
          try {
            // Для Multiple relation передаем массив с одним ID
            await pb.collection('tasks').update(task.id, {
              subtopic: [subtopic.id]
            });
            updated++;
            if (updated % 50 === 0) {
              console.log(`    Обновлено: ${updated}/${tasksToUpdate.length}`);
            }
          } catch (error) {
            console.error(`    Ошибка при обновлении ${task.code}:`, error.message);
          }
        }
        console.log(`  ✓ Обновлено: ${updated}\n`);
      } else {
        console.log(`  Все задачи уже связаны\n`);
      }
    }

    // Проверка результата
    console.log('\nПроверка результата:');
    const testTasks = await pb.collection('tasks').getFullList({
      filter: 'topic = "rjf1a04ykh5uns7"',
      fields: 'id,code,subtopic',
      perPage: 5
    });

    testTasks.forEach(t => {
      console.log(`  ${t.code}: subtopic=${JSON.stringify(t.subtopic)}`);
    });

    console.log('\nГотово!');

  } catch (error) {
    console.error('Ошибка:', error);
  }
}

updateSubtopicsArray();
