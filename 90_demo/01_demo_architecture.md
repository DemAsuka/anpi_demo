# デモ環境（案A）全体像

## 本番資料の参照

以下の「本番の一次リリース構成」をベースに、通知先だけを「あなたのDM」に置き換えています。

- 参照: `1_docs/manuals/報告用_実装前計画案_GenSpark台本_2025-12-22.md`

## 全体図

```mermaid
flowchart TD
  subgraph slackWS[SlackWorkspace]
    YourDM[YourDM]
    SlackWorkflow[SlackWorkflowBuilder]
  end

  subgraph vercelDemo[VercelDemo]
    NextApp[NextjsApp]
    ApiCron[ApiCron_Jma]
    ApiDemo[ApiDemo_Training]
    ApiSlack[ApiSlackResponses]
  end

  subgraph authService[Auth Service]
    Clerk[Clerk Auth / Google]
  end

  subgraph supabaseDemo[SupabaseDemo]
    DB[(PostgreSQL)]
  end

  Clerk -->|JWT Token| NextApp
  NextApp -->|Verify JWT| DB
  JMA[JMA_XML_Feeds] -->|poll| ApiCron
  ApiCron -->|upsert| DB
  ApiCron -->|notify| YourDM

  ApiDemo -->|create_incident| DB
  ApiDemo -->|notify| YourDM

  SlackWorkflow -->|webhook| ApiSlack
  ApiSlack -->|insert_response| DB

  NextApp -->|read_dashboard| DB
  NextApp -->|admin_login| Clerk
```

## デモで確認したい「最小の成立」

- **起動確認**（災害なしでOK）
  - `ApiDemo_Training` を叩くと `YourDM` に `[DEMO] 訓練です` が届く
- **監視確認**（災害なしでOK）
  - `ApiCron_Jma` を叩くと `DB(jma_entries)` が更新され、必要に応じて `YourDM` に通知が届く
- **回答確認**（デモで任意）
  - Workflow Webhook → `ApiSlackResponses` → `DB(responses)` が保存される

