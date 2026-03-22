import { ModeId } from "@shared/modes";
import { AuditSummary, EnsoConfig, KnowledgeSource, RetrievedSnippet, StateSnapshot } from "@shared/types";
import { Badge } from "@renderer/components/ui/badge";
import { Button } from "@renderer/components/ui/button";
import { Card, CardContent } from "@renderer/components/ui/card";
import { ScrollArea } from "@renderer/components/ui/scroll-area";
import {
  boolLabel,
  densityLabel,
  granularityLabel,
  modeLabel,
  providerLabel,
  resultTypeLabel,
  taskStatusLabel,
  tracePhaseLabel,
  verificationStatusColor,
  verificationStatusLabel
} from "@renderer/lib/labels";

export interface RightPanelProps {
  activeMode: ModeId;
  activeModeDescription: string;
  config: EnsoConfig | null;
  knowledgeSources: KnowledgeSource[];
  workspaceRoot: string;
  stateSnapshot: StateSnapshot;
  auditSummary: AuditSummary | null;
  latestRetrievedSnippets: RetrievedSnippet[];
  isLoading: boolean;
  isSubmitting: boolean;
  onResolvePendingConfirmation: () => void;
}

const RightPanel = (props: RightPanelProps): JSX.Element => {
  const {
    activeMode,
    activeModeDescription,
    config,
    knowledgeSources,
    workspaceRoot,
    stateSnapshot,
    auditSummary,
    latestRetrievedSnippets,
    isLoading,
    isSubmitting,
    onResolvePendingConfirmation
  } = props;

  return (
    <aside className="flex h-full min-h-0 flex-col gap-2.5 overflow-hidden" data-testid="right-rail">
      <Card className="shrink-0" data-testid="context-panel">
        <CardContent className="p-3 space-y-3">
          <div>
            <div className="text-[15px] font-semibold text-foreground">
              {activeMode === "default" ? "Enso" : modeLabel(activeMode)}
            </div>
            {activeMode !== "default" && (
              <div className="text-[11px] text-muted-foreground mt-0.5 leading-relaxed">{activeModeDescription}</div>
            )}
          </div>
          <div className="rounded-xl bg-black/[0.03] divide-y divide-black/[0.04] overflow-hidden">
            {(
              [
                ["\u63d0\u4f9b\u5546", config ? providerLabel(config.provider.provider) : "--"],
                ["\u6a21\u578b", config?.provider.model ?? "--"],
                ["\u77e5\u8bc6", `${knowledgeSources.length} \u4e2a\u6765\u6e90`],
                ["\u5de5\u4f5c\u533a", workspaceRoot || "--"],
                ["\u5bc6\u5ea6", config ? densityLabel(config.expression.density) : "--"],
                ["\u6c47\u62a5", config ? granularityLabel(config.reportingGranularity) : "--"]
              ] as const
            ).map(([label, value]) => (
              <div key={label} className="flex items-center justify-between px-3 py-2 gap-2">
                <span className="text-[11px] text-muted-foreground shrink-0">{label}</span>
                <span className="text-[11px] text-foreground/70 truncate text-right">{value}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card className="min-h-0 flex-1 overflow-hidden">
        <CardContent className="h-full p-0">
          <ScrollArea className="h-full">
            <div className="p-3 space-y-3">
              {/* Plan */}
              <div data-testid="plan-panel">
                <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60 mb-1.5">
                  {"\u8ba1\u5212"}
                </div>
                {stateSnapshot.plan ? (
                  <div className="rounded-xl bg-black/[0.03] p-2.5 space-y-1.5">
                    <div className="text-[11px] font-medium text-foreground">{stateSnapshot.plan.goal}</div>
                    <div className="space-y-0.5">
                      {stateSnapshot.plan.steps.map((step, i) => (
                        <div key={i} className="text-[10px] text-muted-foreground leading-relaxed">
                          {i + 1}. {step}
                        </div>
                      ))}
                    </div>
                    {stateSnapshot.plan.likelyTools.length > 0 && (
                      <div className="text-[10px] text-muted-foreground/60">
                        {"\u5de5\u5177"}: {stateSnapshot.plan.likelyTools.join(", ")}
                      </div>
                    )}
                    <div className="text-[10px] text-muted-foreground/60">
                      {"\u9a8c\u8bc1\u76ee\u6807"}: {stateSnapshot.plan.verificationTarget}
                    </div>
                  </div>
                ) : (
                  <div className="text-[11px] text-muted-foreground/40">
                    {"\u65e0\u8ba1\u5212 (\u7eaf\u5bf9\u8bdd)"}
                  </div>
                )}
              </div>

              {/* Trace */}
              <div data-testid="trace-panel">
                <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60 mb-1.5">
                  {"\u6267\u884c\u8f68\u8ff9"}
                </div>
                {stateSnapshot.trace.length === 0 ? (
                  <div className="text-[11px] text-muted-foreground/40">{"\u65e0\u8f68\u8ff9"}</div>
                ) : (
                  <div className="rounded-xl bg-black/[0.03] divide-y divide-black/[0.04] overflow-hidden">
                    {stateSnapshot.trace.map((entry, i) => (
                      <div key={i} className="px-3 py-1.5">
                        <div className="flex items-center justify-between">
                          <Badge variant="outline" className="text-[9px] px-1.5 py-0">
                            {tracePhaseLabel(entry.phase)}
                          </Badge>
                          <span className="text-[9px] text-muted-foreground/40">{entry.timestamp.slice(11, 19)}</span>
                        </div>
                        <div className="text-[10px] text-muted-foreground mt-0.5 leading-relaxed break-all">
                          {entry.summary}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Verification */}
              <div data-testid="verification-panel">
                <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60 mb-1.5">
                  {"\u9a8c\u8bc1\u7ed3\u679c"}
                </div>
                {stateSnapshot.verification ? (
                  <div className="rounded-xl bg-black/[0.03] p-2.5">
                    <div
                      className={`text-[12px] font-semibold ${verificationStatusColor(stateSnapshot.verification.status)}`}
                    >
                      {verificationStatusLabel(stateSnapshot.verification.status)}
                    </div>
                    <div className="text-[10px] text-muted-foreground mt-0.5 leading-relaxed">
                      {stateSnapshot.verification.detail}
                    </div>
                  </div>
                ) : (
                  <div className="text-[11px] text-muted-foreground/40">{"\u65e0\u9a8c\u8bc1\u7ed3\u679c"}</div>
                )}
              </div>

              {/* Evidence */}
              <div data-testid="evidence-panel">
                <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60 mb-1.5">
                  {"\u8bc1\u636e"}
                </div>
                {latestRetrievedSnippets.length === 0 ? (
                  <div className="text-[11px] text-muted-foreground/40">{"\u65e0\u68c0\u7d22\u7247\u6bb5"}</div>
                ) : (
                  <div className="space-y-1.5">
                    {latestRetrievedSnippets.slice(0, 3).map((snippet, index) => (
                      <div key={`${snippet.sourcePath}:${index}`} className="rounded-xl bg-black/[0.03] p-2.5">
                        <div className="text-[11px] font-medium text-foreground">{snippet.sourceName}</div>
                        <div className="mt-0.5 text-[10px] text-muted-foreground/50 truncate">{snippet.sourcePath}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Pending action */}
              <div data-testid="pending-action-panel">
                <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60 mb-1.5">
                  {"\u5f85\u786e\u8ba4\u52a8\u4f5c"}
                </div>
                {stateSnapshot.pendingAction ? (
                  <div className="rounded-xl bg-black/[0.03] p-2.5 space-y-1">
                    <div className="text-[11px] font-medium text-foreground">{stateSnapshot.pendingAction.summary}</div>
                    {stateSnapshot.pendingAction.kind === "workspace_write" ? (
                      <div className="text-[10px] text-muted-foreground/70 break-all">
                        {stateSnapshot.pendingAction.targetPath}
                      </div>
                    ) : (
                      <>
                        <div className="text-[10px] text-muted-foreground/70 break-all">
                          {stateSnapshot.pendingAction.workingDirectory}
                        </div>
                        <div className="text-[10px] text-muted-foreground/70 break-all">
                          {stateSnapshot.pendingAction.command}
                        </div>
                      </>
                    )}
                  </div>
                ) : (
                  <div className="text-[11px] text-muted-foreground/40">{"\u65e0\u5f85\u786e\u8ba4\u52a8\u4f5c"}</div>
                )}
              </div>

              {/* State */}
              <div>
                <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60 mb-1.5">
                  {"\u72b6\u6001"}
                </div>
                <div
                  className="rounded-xl bg-black/[0.03] divide-y divide-black/[0.04] overflow-hidden"
                  data-testid="state-panel"
                >
                  {(
                    [
                      ["\u68c0\u7d22", boolLabel(stateSnapshot.retrievalUsed)],
                      [
                        "\u5de5\u5177",
                        stateSnapshot.toolsCalled.length ? stateSnapshot.toolsCalled.join(", ") : "\u65e0"
                      ],
                      ["\u5f85\u786e\u8ba4", boolLabel(stateSnapshot.pendingConfirmation)],
                      ["\u4efb\u52a1", taskStatusLabel(stateSnapshot.taskStatus)]
                    ] as const
                  ).map(([label, value]) => (
                    <div key={label} className="flex items-center justify-between px-3 py-2">
                      <span className="text-[11px] text-muted-foreground">{label}</span>
                      <span className="text-[11px] text-foreground/70">{value}</span>
                    </div>
                  ))}
                </div>
                {stateSnapshot.pendingConfirmation && (
                  <Button
                    data-testid="resolve-confirmation-button"
                    size="sm"
                    className="w-full mt-2"
                    onClick={onResolvePendingConfirmation}
                    disabled={isLoading || isSubmitting}
                  >
                    {stateSnapshot.pendingAction?.kind === "workspace_write"
                      ? "\u786e\u8ba4\u5e76\u6267\u884c\u5de5\u4f5c\u533a\u5199\u5165"
                      : stateSnapshot.pendingAction?.kind === "host_exec"
                        ? "\u786e\u8ba4\u5e76\u6267\u884c\u5de5\u4f5c\u533a\u547d\u4ee4"
                        : "\u786e\u8ba4\u5e76\u6e05\u9664\u95e8\u63a7"}
                  </Button>
                )}
              </div>

              {/* Audit summary */}
              <div>
                <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60 mb-1.5">
                  {"\u5ba1\u8ba1"}
                </div>
                <div
                  className="rounded-xl bg-black/[0.03] divide-y divide-black/[0.04] overflow-hidden"
                  data-testid="audit-summary-panel"
                >
                  {(
                    [
                      ["\u6a21\u5f0f", auditSummary ? modeLabel(auditSummary.mode) : "--"],
                      ["\u68c0\u7d22", auditSummary ? boolLabel(auditSummary.retrievalUsed) : "--"],
                      [
                        "\u5de5\u5177",
                        auditSummary
                          ? auditSummary.toolsUsed.length
                            ? auditSummary.toolsUsed.join(", ")
                            : "\u65e0"
                          : "--"
                      ],
                      ["\u7c7b\u578b", auditSummary ? resultTypeLabel(auditSummary.resultType) : "--"],
                      ["\u98ce\u9669", auditSummary?.riskNotes || "--"]
                    ] as const
                  ).map(([label, value]) => (
                    <div key={label} className="flex items-center justify-between px-3 py-2">
                      <span className="text-[11px] text-muted-foreground">{label}</span>
                      <span className="text-[11px] text-foreground/70">{value}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </ScrollArea>
        </CardContent>
      </Card>
    </aside>
  );
};

export default RightPanel;
