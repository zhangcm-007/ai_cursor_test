from pymongo import MongoClient

from core.config import config

mongo_client = MongoClient(config.mongodb.url)
