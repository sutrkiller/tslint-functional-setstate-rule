import * as ts from "typescript";
import * as Lint from "tslint";
import {isObjectLiteralExpression} from "tsutils";

import {
    IOptions,
    OPTION_UPDATER_ONLY,
    parseOptions
} from "./reactSetStateUsageOptions";
import {
    getFirstSetStateAncestor, isThisPropertyAccess,
    isThisSetState, removeParentheses
} from "../utils/syntaxWalkerUtils";

const FAILURE_STRING = "Do not pass an object into setState. Use functional setState updater instead.";
const FAILURE_STRING_UPDATER_ONLY = `Do not use callback parameter in setState. Use componentDidUpdate method instead (\"${OPTION_UPDATER_ONLY}\" switch).`;
const getFailureStringForAccessedMember = (accessedMember: string) => `Do not access 'this.${accessedMember}' in setState. Use arguments from callback function instead.`;

export class Rule extends Lint.Rules.AbstractRule {
    public static metadata: Lint.IRuleMetadata = {
        description: "Requires the setState function to be called with function as the first argument and without 'this.props' nor 'this.state' access within the function.",
        optionExamples: [true],
        options: {
            items: [
                {
                    enum: [OPTION_UPDATER_ONLY],
                    type: "string",
                },
            ],
            maxLength: 1,
            minLength: 0,
            type: "array",
        },
        optionsDescription: "Not configurable.",
        ruleName: "react-set-state-usage",
        type: "functionality",
        typescriptOnly: false,
    };

    public apply(sourceFile: ts.SourceFile): Lint.RuleFailure[] {
        const options = parseOptions(this.ruleArguments);
        return this.applyWithFunction(sourceFile, walk, options);
    }
}

function walk(ctx: Lint.WalkContext<IOptions>) {
    const {sourceFile, options: {updaterOnly}} = ctx;

    function cb(node: ts.Node): void {
        if (isThisSetState(node)) {
            inspectSetStateCall(node, ctx, updaterOnly);
        }
        else if (isThisState(node) || isThisProps(node)) {
            inspectThisPropsOrStateContext(node, ctx);
        }

        return ts.forEachChild(node, cb);
    }

    return ts.forEachChild(sourceFile, cb);
}

function inspectSetStateCall(node: ts.CallExpression, ctx: Lint.WalkContext<IOptions>, updaterOnly: boolean) {
    const { 0: updaterArgument, 1: callbackArgument, length: argumentsCount } = node.arguments;

    // Forbid object literal
    const bareUpdaterArgument = removeParentheses(updaterArgument);
    if (isObjectLiteralExpression(bareUpdaterArgument)) {
        ctx.addFailureAtNode(updaterArgument, FAILURE_STRING);
    }

    // Forbid second argument if updaterOnly flag set
    if (updaterOnly && argumentsCount > 1) {
        ctx.addFailureAtNode(callbackArgument, FAILURE_STRING_UPDATER_ONLY);
    }
}

function inspectThisPropsOrStateContext(node: ts.PropertyAccessExpression, ctx: Lint.WalkContext<IOptions>) {
    const setStateCall = getFirstSetStateAncestor(node.parent);

    if (setStateCall) {
        ctx.addFailureAtNode(node, getFailureStringForAccessedMember(node.name.text));
    }
}

const isThisState = (node: ts.Node): node is ts.PropertyAccessExpression => isThisPropertyAccess(node) && node.name.text === "state";

const isThisProps = (node: ts.Node): node is ts.PropertyAccessExpression => isThisPropertyAccess(node) && node.name.text === "props";
