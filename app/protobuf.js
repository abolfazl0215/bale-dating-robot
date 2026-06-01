const protobuf = require("protobufjs");
const path = require("path");

const NEW_LIKE_PROTO_PATH = path.join(
  __dirname,
  "../protoBuf_files/newLike.proto"
);

const ACTIVE_USERS_PROTO_PATH = path.join(
  __dirname,
  "../protoBuf_files/activeUsers.proto"
);

let NewLikeProto = null;
let ActiveUsersProto = null;

let newLikeProtoPromise = null;
let activeUsersProtoPromise = null;

async function loadNewLikeProto() {
  if (NewLikeProto) {
    return NewLikeProto;
  }

  if (!newLikeProtoPromise) {
    newLikeProtoPromise = protobuf
      .load(NEW_LIKE_PROTO_PATH)
      .then((root) => {
        NewLikeProto = root.lookupType("Users");
        return NewLikeProto;
      });
  }

  return newLikeProtoPromise;
}

async function loadActiveUsersProto() {
  if (ActiveUsersProto) {
    return ActiveUsersProto;
  }

  if (!activeUsersProtoPromise) {
    activeUsersProtoPromise = protobuf
      .load(ACTIVE_USERS_PROTO_PATH)
      .then((root) => {
        ActiveUsersProto = root.lookupType("Users");
        return ActiveUsersProto;
      });
  }

  return activeUsersProtoPromise;
}

// preload
loadNewLikeProto();
loadActiveUsersProto();

module.exports = {
  get NewLikeProto() {
    return NewLikeProto;
  },

  get ActiveUsersProto() {
    return ActiveUsersProto;
  },

  loadNewLikeProto,
  loadActiveUsersProto,
};