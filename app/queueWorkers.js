const {
  fillForYouListQueue,
  goToNotificationMenu,
} = require("../config/redis");
const state = require("./state");
const lastViewed = state.lastViewed;

function registerLocalQueueWorkers() {
  fillForYouListQueue.process(1, async (job) => {
    const { telegramId, users: newUsers } = job.data;

    try {
      const viewedUsersData = lastViewed.get(telegramId);
      const previouslyViewedUserIds = viewedUsersData?.usersList ?? [];
      const previouslyViewedSet = new Set();

      if (
        Array.isArray(previouslyViewedUserIds) &&
        previouslyViewedUserIds.length > 0
      ) {
        previouslyViewedUserIds.forEach((userId) => {
          try {
            previouslyViewedSet.add(Number(userId));
          } catch (_) {}
        });

        const uniqueNewUsers = newUsers.filter(
          (user) => !previouslyViewedSet.has(Number(user.telegramId)),
        );
        state.forYouList.set(telegramId, uniqueNewUsers);
      } else {
        state.forYouList.set(telegramId, newUsers);
      }
    } catch (error) {
      console.error(
        `Error processing explore queue for telegramId ${telegramId}:`,
        error,
      );
    }
  });

  goToNotificationMenu.process(1, async (job) => {
    const { telegramId } = job.data;
    try {
      console.log("goToNotificationMenu : ", telegramId);
      const id = +telegramId;
      const userEntry = state.usersMap.get(id);
      if (userEntry) {
        const user = userEntry.user;
        user.userStep = "notificationMenu";
        state.usersMap.set(id, { user, time: Date.now() });
      }
    } catch (error) {
      console.error("Error processing explore queue:", error);
    }
  });
}

module.exports = { registerLocalQueueWorkers };
