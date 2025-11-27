import asyncio
from sqlalchemy.ext.asyncio import async_sessionmaker
from app.core.database import async_engine
from app.models.content import Content
from app.services.vector_service import vector_service
from sqlalchemy import select


async def reindex():
    """기존 컨텐츠의 벡터 재인덱싱"""
    AsyncSessionMaker = async_sessionmaker(async_engine, expire_on_commit=False)
    
    try:
        async with AsyncSessionMaker() as session:
            result = await session.execute(
                select(Content).where(
                    Content.status == "completed",
                    Content.summary.isnot(None)
                )
            )
            rows = result.scalars().all()
            
            print(f"📊 처리할 컨텐츠: {len(rows)}개")
            
            success_count = 0
            fail_count = 0
            
            for content in rows:
                print(f"\n🔄 처리 중: {content.title}")
                print(f"   - content_id={content.id}")
                print(f"   - summary_len={len(content.summary) if content.summary else 0}")
                
                try:
                    success = await vector_service.store_content_vector(
                        content_id=content.id,
                        title=content.title or "",
                        summary=content.summary or "",
                        tags=content.tags or [],
                        user_id=content.user_id,
                        is_public=content.is_public or False,
                    )
                    
                    if success:
                        success_count += 1
                        print(f"   ✅ 성공")
                    else:
                        fail_count += 1
                        print(f"   ❌ 실패 (success=False)")
                        
                except Exception as e:
                    fail_count += 1
                    print(f"   ❌ 예외 발생: {e}")
            
            print(f"\n{'='*50}")
            print(f"🎉 완료!")
            print(f"   성공: {success_count}")
            print(f"   실패: {fail_count}")
            print(f"   총합: {success_count + fail_count}")
            
    except Exception as e:
        print(f"❌ 재인덱싱 오류: {e}")
        import traceback
        traceback.print_exc()
        raise


if __name__ == "__main__":
    asyncio.run(reindex())
